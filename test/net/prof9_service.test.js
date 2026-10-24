// PROF9 (2026-10-02) - COOKING AS THE SERVICE KEEPS IT: a dish on the craft route (/v1/prof/craft) - its inputs out of the
// Stores (bought first), no quality (-1), a piece a serving with its signed record (a Cook's two), Cooking's XP at the
// rank's own tier (a clean pan half again, the first time's 500), its rank asked; the cook's hand at 100 (a Chef's feast,
// a Provisioner's dish) signed into the record (`f`) and kept on the piece (0069's `products.hand`) and answered; the
// market's Crafted view carrying the hand; the crafter's limit. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 3.2, 3.3, 9.3, 35.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { holdPieces } from '../realmSeat.mjs';   // INT19: a crafted piece lists out of its seller's realm record
import { xpForRank, topTierOf, PROF_XP_MAX, JOURNEYMAN_RANK } from '../../src/net/professionLaw.js';
import { cookXp, FIRST_CRAFT_XP } from '../../src/net/recipeLaw.js';
import { readProductRecord, verifyProductRecord } from '../../src/net/productRecord.js';
import { ACCOUNT_VERSION } from '../../server-account/src/service.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `cook-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212], 23: [590, 166] };
const STEW = [['food:meat', 2], ['food:mushroom', 1], ['p1:13', 1]];
const FEAST = [['food:meat', 4], ['food:fish', 4], ['food:apple', 2], ['food:orange', 2], ['food:mushroom', 2], ['food:egg', 2]];

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  /** `times` of a recipe's inputs ADDED to what the Stores hold. */
  const stock = (who, list, times = 1, origin = 'own') => {
    for (const [m, n] of list) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, n * times);
  };
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  const cook = (who, recipe, extra2 = {}) => s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra2 }, who.secret);
  const product = (p) => raw.prepare('SELECT * FROM products WHERE provenance = ?').get(p);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  return { ...s, raw, stores, give, stock, xpOf, setXp, cook, product, fund };
}

// ─── A DISH (9.3) ────────────────────────────────────────────────────

test('PROF9 service: a Hunter\'s Stew at the fire - its Raw Meat, Mushroom and Root Bulb out of the Stores (bought first), one piece with its signed record, no quality, its maker; Cooking XP 20 at rank 0 and the first time\'s 500, credited; asked twice one, nothing moved; the next stew no 500, a clean pan half again; the southern Stew the same dish - no 500 (AUDIT PROF-541 R2-S7)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.stock(mac, STEW, 3);
  s.give(mac, 'food:meat', 'bought', 1);
  const ask = { character: mac.character, recipe: 'stew:north', clean: false, name: 'Silverthorn', rid: rid() };
  const r = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.recipe, r.body.quality, r.body.count, r.body.maker, r.body.marked, r.body.first, r.body.xp, r.body.hand], ['stew:north', -1, 1, 'Silverthorn', false, true, 20 + FIRST_CRAFT_XP, null]);
  // PIN MOVED (CRAFT3): a dish is Cooking's, its track its craft's - the XP credited to Provisioning's row, none to a 'cooking' one
  assert.deepEqual([r.body.track.profession, r.body.track.xp, s.xpOf(mac, 'provisioning'), s.xpOf(mac, 'cooking')], ['provisioning', 520, 520, 0]);
  assert.equal(r.body.pieces.length, 1);
  const p = r.body.pieces[0];
  const v = await verifyProductRecord(p.record, s.identityPublic, { subtle: globalThis.crypto.subtle });
  assert.deepEqual([v.ok, v.claims?.r, v.claims?.q, v.claims?.m, v.claims?.f], [true, 'stew:north', -1, 'Silverthorn', undefined], 'signed; no hand');
  const row = s.product(p.provenance);
  assert.deepEqual([row.owner, row.char_id, row.recipe, row.template, row.material, row.quality, row.hand], [mac.id, mac.character, 'stew:north', 685, 0, -1, null]);
  assert.deepEqual([s.stores(mac, 'food:meat'), s.stores(mac, 'food:mushroom'), s.stores(mac, 'p1:13')], [[['own', 5]], [['own', 2]], [['own', 2]]], 'the bought Raw Meat spent first');
  assert.deepEqual(r.body.stores.map((st) => st.material).sort(), ['food:meat', 'food:mushroom', 'p1:13']);
  const again = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.xp, again.body.pieces[0].provenance], [true, 520, p.provenance], 'asked twice: the row\'s answer');
  assert.deepEqual([s.stores(mac, 'food:meat'), s.xpOf(mac, 'provisioning')], [[['own', 5]], 520], 'nothing moved twice');   // PIN MOVED (CRAFT3): Provisioning's track
  const second = await s.cook(mac, 'stew:north');
  assert.deepEqual([second.body.first, second.body.xp], [false, 20], 'the second stew: no 500');
  const clean = await s.cook(mac, 'stew:north', { clean: true });
  assert.deepEqual([clean.body.xp, clean.body.quality], [30, -1], 'a clean pan: half again, never a quality');
  assert.deepEqual((await s.cook(mac, 'stew:north')).body, { error: 'stores-short' }, 'the Root Bulb gone');
  assert.equal(s.xpOf(mac, 'provisioning'), 520 + 20 + 30);   // PIN MOVED (CRAFT3): Provisioning's track
  assert.deepEqual((await s.cook(mac, 'stew:south')).body, { error: 'stores-short' }, 'the southern Root Bulb is its own material');
  // AUDIT PROF-541 R2-S7: the southern Stew is the same dish - its first no 500 (Mac's J7: once per piece and base); a
  // Supper, another dish, its own 500 - north first, then south none
  s.give(mac, 'p2:13', 'own', 1);
  s.stock(mac, [['food:meat', 2], ['food:mushroom', 1]]);
  const south = await s.cook(mac, 'stew:south');
  assert.deepEqual([south.status, south.body.first, south.body.xp], [200, false, 20], 'the southern Stew: no 500');
  s.stock(mac, [['food:fish', 2], ['food:egg', 1], ['p2:9', 1]], 2);
  s.give(mac, 'p1:9', 'own', 1);
  const supN = await s.cook(mac, 'supper:north');
  assert.deepEqual([supN.status, supN.body.first, supN.body.xp], [200, true, 20 + FIRST_CRAFT_XP], 'a Supper: its own 500');
  const supS = await s.cook(mac, 'supper:south');
  assert.deepEqual([supS.status, supS.body.first, supS.body.xp], [200, false, 40], 'the southern Supper: none (the rank\'s tier 2 now - 20 x 2)');
  assert.match(ACCOUNT_VERSION, /^acct180$/   /* PIN MOVED: acct180, FOE-KEEPS (a death to a foe refused and a kill taking a tenth; AUDIT FOE-KEEPS L3: the version moves with the law); PIN MOVED: acct179, STAFF-PANEL 0.2.3 (the staff panel five features folded: Set bank, the Banned tab, Hide me a toggle, the chat Me / Red switch and the in-game staff view; migrations 0164-0165); PIN MOVED: acct178, GUNS-UNFOUND (item law 12: the Hourlock a gilded Dwarven Long Bow, the Sunken Sovereign the Ebony Saber again, the guns minted before lawful as their eras; acct177 on its branch, renumbered past ACCOUNT-HOMES at the merge); PIN MOVED: acct177, ACCOUNT-HOMES and GUILD-HALL-SALE (the homes of an account every character's, a deleted character's homes released, a guild's hall sold at its door; acct90 and migration 0087 on its branch, renumbered past main's acct91-acct176 and migrations 0087-0162 at its merge; migration 0163); PIN MOVED: acct176, STAFF-PANEL-SPEED (the staff panel pages answer in fewer database round trips: reads and the audit row folded together, two indexes; migrations 0161-0162); PIN MOVED: acct175, STAFF-PANEL5 (the staff panel relay half: follow tokens, Message on screen, the staff feeds, hidden staff, freeze and staff chat; acct174 on its branch, renumbered past STAFF-PANEL2-6 at its merge; migrations 0157-0160); PIN MOVED: acct174, STAFF-PANEL2-6 (the staff panel server side: reports and claims, Mute and Ban from the panel, notes, watchlist, settings, server notice, players, trade holds, item removals, economy, census, status tiles and Home; acct171 on its branch, then acct172, renumbered past AUDIT COLLECTIONS-II, SEA VENTURES and LOST-SPOILS at the merges; migrations 0149-0156); PIN MOVED: acct173, LOST-SPOILS (a boss's floor's leftovers to the post from the Lost and Found - /v1/post/lost; acct168 on its branch, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET, AUDIT COLLECTIONS-II and SEA VENTURES at the merge; no migration); PIN MOVED: acct172, SEA VENTURES (acct168 on its branch, then acct169, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET and AUDIT COLLECTIONS-II at the merges - the Eltheric Ocean ventures, one release: item law 11 and the nine records of the Eltheric Tidemail; the season boards of the sea, its bounties and the prizes of its wrecks; migrations from 0146); PIN MOVED: acct171, AUDIT COLLECTIONS-II (the glyph and icon doors answer the honours and the titles of a Charter; acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge); PIN MOVED: acct170, PISTOLET (the item law moved to 10 - the Dwarven Pistolet known to the judge, the Sunken Sovereign lawful as a gilded Pistolet and as the saber minted before; acct168 on its branch, renumbered past STAFF-PANEL1 and CRAFT-PAYS at the merge); PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release (a Novice brew answers two potions; the crafting writs - craftWrits.js, /v1/writs/craft, migration 0145; acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge); PIN MOVED: acct168, STAFF-PANEL1 (the staff panel sign-in - a password, a key only the Staff Panel extension holds and the role lists; staff keys, invites, sessions and an append-only audit, migration 0144); PIN MOVED: acct167, CAKE-CAP-SAID (a festival find answers the cakes found that day, and capped once they are all found; the account festival answers them too; acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge); PIN MOVED: acct166, ESSENCE-LOOSE (Arcane Essence of a piece made of loose goods is loose, never gold, and the Reforge spends it; migration 0142) and SOUL-LAW (item law 9 - a soul of the Enemy Expansion fifty lawful in a Soul Gem or Azura Star; migration 0143 lifts the holds law 8 laid on one), one release; PIN MOVED: acct165, WITCH1 (the Witches Festival - Soul Cakes, the Wyrd Sister sales, the Hearth Offerings, the profile icon) and STAR7 (the fallen stars held - /v1/star/claim, the star_spoils and stars_held of migration 0141, the star under the combat cap), one release; PIN MOVED: acct164, LEAN-READS (LEAN-WITNESS, YARD-SNAP, VENDOR-BOARD, WRIT-BOARD, ARENA-BOARD and SLOW-SHED - a hall's and a seat's late answers read no more, a town's yards, a region's traders and a season's arena board each one row, the writs by owner, a slow database shed as an overloaded one; migrations 0135-0139; acct159, acct160, acct161, acct162 then acct163 and 0133-0137 then 0134-0138 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges); PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP (staff mend a purse below nothing - realm-mend, the hold it made lifted - and a death in the zone takes the packs at the side off the record, a tab that never says it reads them refused; acct162 on its branch, renumbered past the acct162 of NAME-WORDS at the merge); PIN MOVED: acct162, NAME-WORDS (the name filter reads two more words anywhere - a handle holding either is refused; migration 0134 renames the account that held them); PIN MOVED: acct161, JUNGLE-WOODS (a jungle pixel stands 48 trees a day, every slot a tree, the service counting them as the law does; acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges); PIN MOVED: acct160, WB14g (a kill receipt says its night portents, and a portent receipt rolls the Weir Key at the rite odds; acct159 on its branch, renumbered past the acct159 of QL12 at the merge); PIN MOVED: acct159, QL12 (the questlines claim - /v1/ql/claim, the five titles and the Covens Hoard key on the row; migration 0133; acct157 on its branch, renumbered past PLAN-1000 and FOE-BOUNDS, acct157 and acct158, at the merge); PIN MOVED: acct158, FOE-BOUNDS (cases from the relay count - records it stripped, asks past a budget; one line an account a batch; the Discord card says the spawn grants opened it); PIN MOVED: acct157, PLAN-1000 (PRIMARY-FOLD - the door reads in one statement, the spend one step over its row, a week kept, a chapter claim reads in one batch - and SESSION-SIGN, a pass on the hot routes; no migration; acct155 on its branch, renumbered past GRANT2 and TOWN-ECON TE2 at the merge); PIN MOVED: acct156, TOWN-ECON TE2 (the town economy share - /v1/towns/*, migration 0132; LAW-3 counterPaid in the item law); PIN MOVED: acct155, GRANT2 (the spawn grant measure kept - /v1/mod/grant-feed, /v1/mod/realm-grants; migration 0131); PIN MOVED: acct154, PRIVATE-REPORT (the private reports - /v1/report/*, a reader count on the post box; migration 0129 - acct152 then acct153, and 0126 then 0127, on its branch, renumbered past SAFE and INT16-INT19 at the merges); PIN MOVED: acct153, INT16-INT19 (the progression claims' seat and play line, the legacy record's law, a crafted piece out of its seller's record; migrations 0127 and 0128 - acct151 then acct152, and 0125 then 0126 and 0127, on its branch, renumbered past KEY-LAW and SAFE at the merges); PIN MOVED: acct152, SAFE (the chat safety arc and its audit - blocks, reports and cases, bans, the reviewer, Discord; migration 0126 - acct150 and 0125 on its branch, renumbered past WIKIMAID and KEY-LAW at the merge); PIN MOVED: acct151, KEY-LAW (item law 7 - the Weir Key's row known to the service's law, so a key holds no trade; migration 0125 - acct150 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: acct150, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren granted by name - titles.js WIKIMAID_HANDLES, no migration); PIN MOVED: acct149, EG-PLAY (the Elite Breach's Weir Keys, open, admission and claims, migration 0124 - 0112, 0113, 0114, 0116, 0117, 0119, 0120, 0121 then 0123 on its branch, renumbered past SEAT-FACTS' 0112, LAMP-KEEPER II's 0113, FIRMAMENT-ON's 0114, KG6's 0115, POI-1's 0116, SUMMON-REPAIR's 0117, PVP-ESCROW's 0118, SERPENT5's 0119, AUTO-HOLD's 0120, FIELD BUGS 2026-10-16b's 0121 and 0122 and MAKER-KEPT's 0123; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED, D1-LOAD, BAL9, NAME-AS, HACKED-GOLD, ETHER-NODES, AUDIT ETHER-OW, MINE-PERKS, HOMES-SHED, BUSY-GATE, CRAFT-PROCS, SCHOOLS5, RECOVERY-SET, REVIVE, LAMP-KEEPER II, KG6, POI-1 and SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME at the merges; acct141 at the fifth merge, renumbered past AUTO-HOLD, DECOR-BATCH, BOOKMARK-SPIRAL, BUSY-HEART and SHED-LONG at the sixth, then acct146, renumbered past STOLEN-GOODS AUDIT and REZ-BLOODLINE AUDIT R1 at the seventh, then acct148, renumbered past MAKER-KEPT at the eighth); PIN MOVED: acct148, REZ-BLOODLINE AUDIT R1 (the realm holds a Bloodline fall for a Resurrect of the party - the hold of realmDie, the new /v1/realm/raise and the rez-holds close each minute, legacy.js; migration 0121; acct141 on its branch, acct142 at the first merge, renumbered past the SHED-LONG acct145 of main at the second); PIN MOVED: acct146, STOLEN-GOODS AUDIT (a patron of a town takes no stolen piece off a hired trader - net/patronLaw.js patronTakes; no migration); PIN MOVED: acct145, SHED-LONG (BOOKMARK-SPIRAL rolled back, the shed 10 s - service.js, busyLaw.js; no migration); PIN MOVED: acct144, BUSY-HEART (the heartbeat and the motherlodes stand back while the database is overloaded - busyLaw.js; no migration); PIN MOVED: acct143, BOOKMARK-SPIRAL (the polled display reads with no bookmark off any instance, a missed session lookup asks the primary - service.js, accounts.js; no migration); PIN MOVED: acct142, DECOR-BATCH (a home room one request, a shunned home shop one more - decor.js; no migration); PIN MOVED: acct141, AUTO-HOLD (a copy locks its piece, never the character; the third law hold is timed - migration 0120; acct139 on its branch, renumbered past PRIMARY-TRIPS and AUDIT GUILD-WORDS at the merge); PIN MOVED: acct140, AUDIT GUILD-WORDS (a new membership recorded off the standing before a claim loss or after it, and every Roll answer saying what it paid of what was owed - npcRoll.js, no migration; acct139 on its branch, renumbered past PRIMARY-TRIPS acct139 at the merge); PIN MOVED: acct139, PRIMARY-TRIPS (the account primary round trips cut - the seats list, a checkpoint and a badge honours each one batch, the yards off a replica, a heartbeat reads before its beat, a hall bump off its own key rows; no migration); PIN MOVED: acct138, CART-AWAY (a wagon away from a death in the zone keeps its cargo - wild.js, no migration); PIN MOVED: acct137, SERPENT5 (Coilbreaker and The Maelstrom rolled on a dealing ship serpent kill first write - serpents.js, migration 0119; acct135 on its branch, renumbered past POI-1 acct135 and SUMMON-REPAIR acct136 of main at the merge); PIN MOVED: acct136, SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME (staff mend one realm character - a FactionFile flag bit cleared and gold given back as a letter of credit, once a ticket; bible/06-Systems/Integrity-Arc.md INT6; migration 0117, 0113 on its branch and 0114 on the integration; a killer worn piece held in escrow until collected - wild_escrow and three wild routes; bible/11-Multiplayer/Wild-Zone.md section 4; migration 0118, 0113 on its branch and 0115 on the integration; the layouts read names every home by its building, so no quest picks a player home in a town never walked into; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; no migration; acct133 on each branch, one bump past LAMP-KEEPER II at the merge, acct134 on the integration, renumbered past KG6 acct134 and POI-1 acct135 at the merge of main); PIN MOVED: acct135, POI-1 + POI-4b + AUDIT POI (the POI store and the library's shelf - builders draft, an approver decides, the feed is live revisions only; bible/06-Systems/POI-Editor-Arc.md; migration 0116 - acct133, then acct134, and 0113, then 0114, on its branch, renumbered past LAMP-KEEPER II's and KG6's at the merges); PIN MOVED: acct134, KG6 (The King's Gambit's season board and its Grandmaster - gambit.js, the escrow's King's Gambit arm in cards.js; migration 0115 (0114 on its branch, renumbered past main's FIRMAMENT-ON 0114 at the merge); acct133 on its branch, renumbered past LAMP-KEEPER II's acct133 at the merge); PIN MOVED: acct133, LAMP-KEEPER II (I Love Lamp laid on the row) - before it acct132, REVIVE (a death taken back holds - putLineage takes the stored copy revived stamps into every copy sent; bible/06-Systems/Legacy-Arc.md REVIVE; no migration); PIN MOVED: acct131, RECOVERY-SET (eight recovery codes, each spent alone, and a new set from the profile behind the password and one current code - /v1/account/recovery-codes, recoveryLeft on the account view; bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md RECOVERY-SET; no migration, the same column); PIN MOVED: acct130, SCHOOLS5 (the specialisation a save carries judged - a path the table holds, both its schools mastered; bible/06-Systems/Arcane-Specialisations.md section 7; no migration; acct127 on its branch, renumbered past HOMES-SHED, BUSY-GATE and CRAFT-PROCS at the merge); PIN MOVED: acct129, CRAFT-PROCS (a crafted piece record carries its mint version - stamped at the craft, kept by a temper, read by the market piece; no migration; acct126, acct127, then acct128, on its branch - renumbered past MINE-PERKS, HOMES-SHED and BUSY-GATE at the merges); PIN MOVED: acct128, BUSY-GATE (the reads busyLaw names stand back while the database is overloaded - the client holds them, the isolate sheds them a moment, every overload answer says its Retry-After; no migration); PIN MOVED: acct127, HOMES-SHED (the homes of a town and its Open Gates one request to the database where they were two; the siege blackout question answering a throw as every route does - an overload a 503; no migration); PIN MOVED: acct126, MINE-PERKS (a Surveyor's own surface veins and their gem on unwitnessed ground, the Deep Delver's x2 - bible/06-Systems/Professions-Arc.md 43; no migration); PIN MOVED: acct125, AUDIT ETHER-OW (C2-1: a Motherlode site is a pixel a Watch receipt can name - never past the Veil, where none is minted; no migration); PIN MOVED: acct124, ETHER-NODES (an Eltheric isle's node, a haul and its pixels' witnesses taken - the nodes' ground the Eltheric Ocean's box beside the Bay's map; no migration); PIN MOVED: acct123, HACKED-GOLD (a purse, a letter of credit or a coin pile past one DFU int a law finding; staff read who gained past the bucket and whom a character traded with; no migration; acct121 then acct122 on its branch, renumbered past BAL9 and NAME-AS at the merges); PIN MOVED: acct122, NAME-AS (the account name or the played realm character name as the name the room reads, chosen on the profile card, migration 0111; a letter to a friend and a board note author found by account; acct121 on its branch, renumbered past BAL9 at the merge); PIN MOVED: acct121, BAL9 (item law 3 - the potency and wellspring lines and the arcane three lawful; no migration); PIN MOVED: acct120, D1-LOAD (the seat registry read from the kept rows of the isolate by every caller, the lease read before it is written; no migration; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED at the merge); PIN MOVED: acct119, SEAT-LEASE (the Turning settled by one request at a time under a lease, migration 0110); PIN MOVED: acct117, YARD-SWEEP + HANDLE-EMAIL (the yard pieces above the height cap swept, migration 0109, and none served; a username never an email address, one chosen before read as its guest name); PIN MOVED: acct116, CRAFT-HOLD (the exploit audit: the INT3 hold follows a crafted piece, a held character with crafts at the account neither deleted nor depositing nor supplying, and the CRAFT-WORTH patron worth; no migration; acct115 on its branch, renumbered past BR5 at the merge); PIN MOVED: acct115, BR5 (the Patreon link page titled by the product name; acct113 on its branch, renumbered past GUILD-SEEN and GUILD3 at the merge); PIN MOVED: acct114, GUILD3 (the guilds made plain: the silver lines by kind and way, the whole list of holds, the Failing fall, the High Master by the band; no migration; acct112 then acct113 on its branch, renumbered past SCALE4f-h and GUILD-SEEN at the merges); PIN MOVED: acct113, GUILD-SEEN (the guild roster says when each member was last online); PIN MOVED: acct112, SCALE4f + SCALE4g + SCALE4h (acct111 on its branch, renumbered past HOME-VOTE at the merge); PIN MOVED: acct111, HOME-VOTE (a town's votes on its homes, migration 0108 - acct109, then acct110, on its branch, renumbered past PATRON-LOAD and PATRON-LOAD II at the merges); PIN MOVED: acct110, PATRON-LOAD II (the region's traders read by its own indexes - D1 overloaded; migration 0107); PIN MOVED: acct109, PATRON-LOAD (the region's traders read reckons no patrons - D1 overloaded; no migration); PIN MOVED: acct108, TECH1 (the item law's version 2 - a weapon's technique line, after LW15 took acct107; bible/05-Combat/Weapon-Techniques.md); PIN MOVED: acct107, LW15 (THE PATRONS, migration 0106 - acct105, then acct106, on its branch, renumbered past INT11-INT14 and SCALE4d at the merges); PIN MOVED: acct106, SCALE4d (the token's mint on a D1 session, no migration); PIN MOVED: acct105, INT7-INT10 (the INTEGRITY arc's lane 2, migration 0104 - acct102 on its branch, renumbered past the Chapters' acct103 at the merge); PIN MOVED: acct103, the Chapters (CHAP1-CHAP7b) past UNWITNESSED-ORE's acct102, BAG-CRAFT's acct101, INT1-INT6's acct100, CARDS9-CARDS10's acct99, PERMADEATH-HOUSES' acct98, SERVER-POST's acct97, TAVERN CARDS' acct96 and SCALE4's acct95 at the merges; PIN MOVED (PROF10, PROF12, AUDIT PROF-541, SILVER-WAYS' acct71, the arena merge's acct72, AEGIS's acct73, BAG1 and GUILD2's acct74, HOME-PRICE's acct75, PRIMARCH and FOUNDER4's acct76, FIELD BUGS 2026-10-04d KNIGHT-HOUSE's acct77, SERPENT1's acct78, GLOBAL-MARKET's acct79, SHADOW-CLOAK's acct80, SERAPH-WINGS' acct81, AUDIT ARENA-LADDER's acct82, CRYSTAL-FIST's acct83, SERPENT-SET and SILVER-FINDS' acct84, YARD-SHED's acct85, YARD-HEIGHT's acct86, LEGACY7's acct87, STORM-SHED's acct88, STORM-SHED 2's acct89, TEXT-F1's acct90, CAP-OFF's acct91, FOUNDER5's acct92, CRAFT2-CRAFT5's acct93, SD9b's acct94 - acct91 on its branch, renumbered past CAP-OFF, FOUNDER5 and CRAFT2-CRAFT5 at the merges; SCALE4a-c's acct95 - acct94 on its branch, renumbered past SD9b at the merge): the live version */);   // PIN MOVED: acct148, MAKER-KEPT (item law 6 - a maker-era Aetheric piece keeps its maker's rows; migration 0123); PIN MOVED: acct120, D1-LOAD (the seat registry read from the kept rows of the isolate by every caller, the lease read before it is written; no migration; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED at the merge); PIN MOVED: acct119, GATHER-SPEED + MARKET-SPEED (a harvest's, the professions' state's and a market read's reads batched into a few round trips; the seats' places off the isolate's kept rows for a Levy, a Tithe and a board's listings; no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge); PIN MOVED: acct105, INT11-INT14 (the INTEGRITY arc's lane 3, migration 0105)
});

test('PROF9 service: a dish\'s rank is asked (the Tart 10, the Feast 70 - refused below, nothing spent); XP follows the rank - a stew at rank 55 is 20 x tier 5, never a quarter; a Master\'s full track credits none, answered so', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.stock(mac, [['food:apple', 2], ['food:egg', 1], ['p2:17', 1]]);
  s.stock(mac, FEAST);
  assert.deepEqual([(await s.cook(mac, 'tart:south')).status, (await s.cook(mac, 'tart:south')).body], [403, { error: 'prof-rank' }]);
  assert.deepEqual([s.stores(mac, 'food:apple'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_crafts').get().n], [[['own', 4]], 0], 'refused before anything moved');
  // PIN MOVED (CRAFT3): a dish's rank is read on Provisioning's track (seeded after the migrations, so under the craft's id)
  s.setXp(mac, xpForRank(10), 'provisioning');
  const tart = await s.cook(mac, 'tart:south');
  assert.deepEqual([tart.status, tart.body.xp, s.stores(mac, 'p2:17')], [200, 40 + FIRST_CRAFT_XP, []]);
  s.setXp(mac, xpForRank(69), 'provisioning');
  assert.deepEqual((await s.cook(mac, 'feast:hearth')).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(55), 'provisioning');
  s.stock(mac, STEW);
  const at55 = await s.cook(mac, 'stew:north');
  assert.deepEqual([at55.body.xp, topTierOf(55)], [5 * 20 + FIRST_CRAFT_XP, 5]);
  assert.equal(at55.body.xp, cookXp(55) + FIRST_CRAFT_XP);
  s.setXp(mac, PROF_XP_MAX, 'provisioning');
  s.stock(mac, STEW);
  const full = await s.cook(mac, 'stew:north', { clean: true });
  assert.deepEqual([full.status, full.body.xp, s.xpOf(mac, 'provisioning')], [200, 0, PROF_XP_MAX]);   // PIN MOVED (CRAFT3): Provisioning's track
});

test('PROF9 service: the cook\'s choices - a Cook\'s dish two servings, each its own piece and record (3.3: "+1 serving a dish"), its XP the cook\'s, not the servings\'; a Provisioner\'s dish carries its hand 2 (record and piece); a Chef\'s feast its hand 1, a Chef\'s stew none', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  // PIN MOVED (CRAFT3): the Cook, the Provisioner and the Chef stand under Provisioning's track, Cooking's craft
  s.setXp(mac, xpForRank(50), 'provisioning', { spec50: 'cook' });
  s.stock(mac, STEW, 2);
  const two = await s.cook(mac, 'stew:north');
  assert.equal(two.status, 200, JSON.stringify(two.body));
  assert.deepEqual([two.body.count, two.body.pieces.length, two.body.xp], [2, 2, cookXp(50) + FIRST_CRAFT_XP]);
  assert.notEqual(two.body.pieces[0].provenance, two.body.pieces[1].provenance);
  assert.deepEqual(two.body.pieces.map((p) => readProductRecord(p.record)?.r), ['stew:north', 'stew:north']);
  assert.deepEqual(two.body.pieces.map((p) => s.product(p.provenance)?.owner), [mac.id, mac.id]);
  assert.deepEqual(s.stores(mac, 'food:meat'), [['own', 2]], 'one cook\'s inputs');
  // the Provisioner
  s.setXp(mac, xpForRank(100), 'provisioning', { spec50: null, spec100: 'provisioner' });
  const prov = await s.cook(mac, 'stew:north');
  assert.deepEqual([prov.body.hand, prov.body.count], [2, 1]);
  assert.deepEqual([readProductRecord(prov.body.pieces[0].record).f, s.product(prov.body.pieces[0].provenance).hand], [2, 2]);
  // the Chef: a feast's hand, a stew's none
  s.setXp(mac, xpForRank(100), 'provisioning', { spec100: 'chef' });
  s.stock(mac, FEAST);
  s.stock(mac, STEW);
  const feast = await s.cook(mac, 'feast:hearth', { clean: true });
  assert.equal(feast.status, 200, JSON.stringify(feast.body));
  assert.deepEqual([feast.body.hand, readProductRecord(feast.body.pieces[0].record).f, s.product(feast.body.pieces[0].provenance).hand], [1, 1, 1]);
  assert.equal(feast.body.xp, 0, 'a Master\'s track: full');
  const stew = await s.cook(mac, 'stew:north');
  assert.deepEqual([stew.body.hand, readProductRecord(stew.body.pieces[0].record).f, s.product(stew.body.pieces[0].provenance).hand], [null, undefined, null]);
});

test('PROF9 service: the crafter\'s limit holds Cooking at Journeyman while two other crafts stand past it - credited to the cap, answered so', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  // PIN MOVED (CRAFT3): the limit counts the five crafts' tracks - a dish's Provisioning held while Smithing and Building
  // (Carpentry's craft) stand past 50
  s.setXp(mac, xpForRank(60), 'smithing');
  s.setXp(mac, xpForRank(60), 'building');
  s.setXp(mac, xpForRank(JOURNEYMAN_RANK + 1) - 10, 'provisioning');
  s.stock(mac, STEW);
  const r = await s.cook(mac, 'stew:north');
  assert.deepEqual([r.status, r.body.xp, s.xpOf(mac, 'provisioning')], [200, 9, xpForRank(JOURNEYMAN_RANK + 1) - 1]);   // PIN MOVED (CRAFT3): Provisioning's track
});

test('PROF9 service: a Provisioner\'s dish lists on the market among the Dishes and is read with its hand - the Crafted view and the lister\'s own; 0069 gives every piece a hand column, none before it, and refuses a hand that is no cook\'s', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.setXp(mac, xpForRank(100), 'provisioning', { spec100: 'provisioner' });   // PIN MOVED (CRAFT3): the Provisioner stands under Provisioning's track
  s.stock(mac, STEW);
  const made = await s.cook(mac, 'stew:north');
  const provenance = made.body.pieces[0].provenance;
  holdPieces(s.env, mac.character, [{ provenance }]);   // PIN MOVED (INT19): the dish the pack took, in the record the listing takes it out of
  s.fund(mac, 100);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance, wear: 1000, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const mine = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret);
  const row = mine.body.rows.find((x) => x.piece?.provenance === provenance);
  assert.deepEqual([row?.piece?.recipe, row?.piece?.hand, row?.piece?.quality], ['stew:north', 2, -1]);
  const crafted = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'crafted', hubs: HUBS }, mac.secret);
  assert.equal(crafted.body.rows.find((x) => x.piece?.provenance === provenance)?.piece?.hand, 2);
  // a plain dish reads no hand
  s.setXp(mac, xpForRank(0), 'provisioning');   // PIN MOVED (CRAFT3): Provisioning's track
  s.stock(mac, STEW);
  const plain = await s.cook(mac, 'stew:north');
  const pp = plain.body.pieces[0].provenance;
  holdPieces(s.env, mac.character, [{ provenance: pp }]);
  s.fund(mac, 100);
  assert.equal((await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: pp, wear: 1000, price: 5, hubs: HUBS, rid: rid() }, mac.secret)).status, 200);
  const mine2 = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret);
  assert.equal(Object.hasOwn(mine2.body.rows.find((x) => x.piece?.provenance === pp)?.piece ?? {}, 'hand'), false);
  // the column
  const cols = s.raw.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  assert.ok(cols.includes('hand'));
  assert.throws(() => s.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, hand)
    VALUES ('fedcba9876543210', ?, ?, NULL, 'stew:north', 685, 0, -1, 1, 'p1.x.', 1, 3)`).run(mac.id, mac.character), /CHECK/);
});
