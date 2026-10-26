// WB14g (2026-10-19, Mac: "This is all yours to take on"): WHAT A PORTENT NIGHT PAYS - the kill's receipt says the night's
// portents a bit each (1 the Vanguard, 2 the Sundering, 4 the Captive freed; a Captive night whose knight stayed chained
// says none), the spoils roll one more piece of Magic or better for each, after every draw they made before (the Dragonfire
// Oath's law: a receipt without them rolls what it always rolled), each such piece's picture drawn last; and the account
// service rolls the Weir Key at the rite's odds for a receipt that carries any.
//
//   the law          net/gate/gateBrain.js receiptPortents; net/gate/gateReceipt.js `p` (RECEIPT_PORTENTS_MAX, optional, never
//                    on the rite's own receipt)
//   the relay        server/src/index.js the mint's `p`
//   the spoils       systems/gate/gateSpoils.js rollSpoils's `p`, SPOILS_PORTENT_BITS; scenes/spoilsPool.js spoilsList (the
//                    claims' `p`, the pieces' pictures last)
//   the account      server-account/src/eg.js EG_KEY_ODDS_PORTENT, egGateWeir; ACCOUNT_VERSION acct160 (acct159 on its branch, renumbered past QL12's at the merge)
//
// Design: bible/11-Multiplayer/Breach-Portents.md section 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { newFight, receiptPortents } from '../../../src/net/gate/gateBrain.js';
import { portentBits, GATE_PORTENTS } from '../../../src/net/gate/gateMods.js';
import { receiptValid, mintReceipt, readReceipt, RECEIPT_PORTENTS_MAX, RECEIPT_TTL_S } from '../../../src/net/gate/gateReceipt.js';
import { rollSpoils, SPOILS_PORTENT_BITS, SPOILS_SOURCE } from '../../../src/systems/gate/gateSpoils.js';
import { spoilsList } from '../../../src/scenes/spoilsPool.js';
import { egGateWeir, EG_KEY_ODDS, EG_KEY_ODDS_RITE, EG_KEY_ODDS_PORTENT } from '../../../server-account/src/eg.js';
import { ACCOUNT_VERSION } from '../../../server-account/src/service.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const night = (pt, freed = 0) => Object.assign(newFight(7, T0, T0 + 3_600_000, 'ruhn', null, pt, null), freed ? { cp: { at: 1, n: 2, f: freed, w: 0, s: 0 } } : {});
const claims = (extra = {}) => ({ d: 7, b: 'ruhn', s: 'acct-1', c: 12345, x: 'dealt', i: 1000, e: 1000 + RECEIPT_TTL_S, ...extra });

test('WB14g the receipt\'s portents: the night\'s, a bit each - the Vanguard 1, the Sundering 2, the Dire Breach both, the Captive 4 only freed, a plain night none (mutants: the Captive\'s bit for a knight left chained; the night\'s bits unsaid)', () => {
  assert.deepEqual(GATE_PORTENTS.map((p) => [p.id, p.bit]), [['vanguard', 1], ['sunder', 2], ['captive', 4]]);
  assert.equal(receiptPortents(night(null)), 0);
  assert.equal(receiptPortents(night(['vanguard'])), 1);
  assert.equal(receiptPortents(night(['sunder'])), 2);
  assert.equal(receiptPortents(night(['vanguard', 'sunder'])), 3, 'the Dire Breach');
  assert.equal(receiptPortents(night(['captive'])), 0, 'his knight left chained says none');
  assert.equal(receiptPortents(night(['captive'], T0 + 60_000)), 4, 'freed');
  assert.equal(receiptPortents(null), 0);
  assert.equal(RECEIPT_PORTENTS_MAX, portentBits(GATE_PORTENTS.map((p) => p.id)));
});

test('WB14g the receipt: `p` optional - a whole number of the portents\' bits, never 0, never on the rite\'s own receipt; minted only for a portent night, and read back as minted (mutants: a `p` past every bit; one on the rite\'s ember; a `p` of 0 written)', async () => {
  assert.ok(receiptValid(claims()), 'none, as ever');
  for (const p of [1, 2, 3, 4, 7]) assert.ok(receiptValid(claims({ p })), String(p));
  for (const p of [0, 8, -1, 1.5, '1', null]) assert.ok(!receiptValid(claims({ p })), String(p));
  assert.ok(!receiptValid(claims({ x: 'rite', p: 1 })), 'the rite\'s ember is its own');
  assert.ok(receiptValid(claims({ x: 'stood', p: 4 })));
  const env = { subtle: webcrypto.subtle, nowS: 1000 };
  const with3 = readReceipt(await mintReceipt({ d: 7, b: 'ruhn', s: 'acct-1', c: 9, x: 'dealt', l: 20, p: 3 }, null, env));
  assert.equal(with3.p, 3);
  const plain = readReceipt(await mintReceipt({ d: 7, b: 'ruhn', s: 'acct-1', c: 9, x: 'dealt', l: 20, p: 0 }, null, env));
  assert.equal('p' in plain, false, 'a plain night writes none');
  assert.match(read('server/src/index.js'), /\.\.\.this\._bodyMeasureOf\(f, sub, GATE_SEAM\.earned\), \.\.\.\(receiptPortents\(f\) \? \{ p: receiptPortents\(f\) \} : \{\}\) \}, key,/, 'the relay mints it on the fight\'s receipts');
  assert.match(read('server/src/index.js'), /mintReceipt\(\{ d: book\.d, b: boss, s: sub, c: rand32\(\), x: 'rite' \}, key,/, 'never on the rite\'s - PIN MOVED (GATE-COURTS): minted by the night\'s book, once every court is done');
});

test('WB14g the spoils: one more piece of Magic or better for each portent, after every draw before - the pieces before it the same for its seed, the ember, the card and the gems the same; a plain night\'s spoils what they always were (mutants: the pieces drawn first; a bit paying nothing; a Common piece)', () => {
  assert.deepEqual(SPOILS_PORTENT_BITS, [1, 2, 4]);
  for (const seed of [1, 777, 0xdeadbeef]) {
    const base = rollSpoils(seed, 20), same = rollSpoils(seed, 20, 0);
    assert.deepEqual(same.pieces.map((p) => [p.item.name, p.tier]), base.pieces.map((p) => [p.item.name, p.tier]), 'p 0 is the plain roll');
    assert.equal(base.portent, 0);
    for (const [p, n] of [[1, 1], [2, 1], [4, 1], [3, 2], [5, 2], [7, 3]]) {
      const s = rollSpoils(seed, 20, p);
      assert.equal(s.portent, n, `${p}: one a bit`);
      assert.equal(s.pieces.length, base.pieces.length + n);
      assert.deepEqual(s.pieces.slice(0, base.pieces.length).map((q) => [q.item.name, q.tier]), base.pieces.map((q) => [q.item.name, q.tier]), `${seed}/${p}: every piece before, its own`);
      assert.equal(s.gold, base.gold);
      assert.deepEqual(s.card?.name ?? null, base.card?.name ?? null);
      assert.deepEqual((s.gems ?? []).map((g) => g.name), (base.gems ?? []).map((g) => g.name));
      for (const q of s.pieces.slice(base.pieces.length)) assert.ok(['magic', 'rare', 'legendary', 'exalted'].includes(q.tier), `${q.tier}: Magic or better`);
    }
  }
  assert.ok(SPOILS_SOURCE.boss, 'at a boss\'s chances');
});

test('WB14g the floor: a portent receipt\'s pieces leave him with the rest, each one\'s picture drawn after every other\'s - every other entry\'s picture what the plain receipt\'s is (mutants: the claims\' `p` unread; the pictures shifted)', () => {
  for (const seed of [5, 4242]) {
    const plain = spoilsList(seed, 20, { x: 'dealt' }), rich = spoilsList(seed, 20, { x: 'dealt', p: 3 });
    assert.equal(rich.length, plain.length + 2);
    const items = (l) => l.filter((e) => e.kind === 'item').map((e) => e.item.name);
    const extra = rollSpoils(seed, 20, 3).pieces.slice(-2).map((q) => q.item.name);
    for (const name of extra) assert.ok(items(rich).includes(name), name);
    const pics = (l) => l.filter((e) => !extra.includes(e.item?.name)).map((e) => e.record);
    assert.deepEqual(pics(rich), pics(plain), 'every other picture its own');
  }
  assert.equal(spoilsList(5, 20, { x: 'rite', p: 3 }).length, 1, 'the rite\'s ember alone');
});

test('WB14g the Weir Key: a portent night\'s receipt rolls at the rite\'s odds - a quarter - where a plain one rolls one in six; acct160 (mutants: a portent receipt at the plain odds; the version unmoved)', () => {
  assert.equal(EG_KEY_ODDS_PORTENT, EG_KEY_ODDS_RITE);
  assert.equal(EG_KEY_ODDS_PORTENT, 1 / 4);
  assert.ok(EG_KEY_ODDS < EG_KEY_ODDS_PORTENT);
  const binds = [];
  const db = { prepare: () => ({ bind: (...a) => (binds.push(a), a) }) };
  const rand = (b) => b.fill(0x33);   // the die at 0.2: under a quarter, over a sixth
  const roll = egGateWeir({ db, rand }, { id: 'acct-1' });
  roll(claims());
  roll(claims({ p: 1 }));
  roll(claims({ r: 1 }));
  assert.deepEqual(binds.map((a) => a[2]), [0, 1, 1], 'plain, a portent night\'s, the rite\'s');
  assert.equal(ACCOUNT_VERSION, 'acct194');   // PIN MOVED: acct194, NIRNROOT-SAGE (NIRNROOT_SAGE_HANDLES grants Blob-Marley a title, its glyph and an aura); PIN MOVED: acct193, COPY-LIFT (FIELD BUGS 2026-10-25i: the staff purge with keep keeps one of each copied piece and lifts its lock in the same batch; acct191 on its branch, renumbered past YARD-TOWN acct191 and ECON-LEFT-OUT acct192 on main at the merge); PIN MOVED: acct192, ECON-LEFT-OUT and ECON-WORTH (acct192 on its branch, renumbered past main's acct192-acct191 at the merge; the staff Economy keeps banned and trade-held characters out of its gold totals and adds the game worth; the census tally keeps the bank share); PIN MOVED: acct185, CLOTH-GEMS (the loom weaves Linen and spins Wool, AUDIT 32 S1 judges the units, the jeweller sets every grade of gem; acct182 on its branch, renumbered past STAFF-EVENT, AUDIT HIDDEN-UNCOUNTED and STAFF-EVENT BOSS at the merge); PIN MOVED: acct184, STAFF-EVENT BOSS (an exact boss health hp staged, and clear takes an event that is over off the list); PIN MOVED: acct183, AUDIT HIDDEN-UNCOUNTED (a hidden staff member reads offline in their guild, last online the moment they hid; the reader's own row marked hidden; acct182 on its branch, renumbered past STAFF-EVENT at the merge); PIN MOVED: acct182, STAFF-EVENT (staff events from the panel - staged, ended, the mini boss called, the meters read; migration 0167; acct181 on its branch, renumbered past KETCH at the merge); PIN MOVED: acct181, KETCH (the sky-ketch Mzunthar, a weekly raid of eight - its claim and migration 0166; item law 13 - the airship gilded pair lawful; acct180 on its branch, renumbered past FOE-KEEPS' acct180 at the merge); PIN MOVED: acct180, FOE-KEEPS (a death to a foe refused and a kill taking a tenth; AUDIT FOE-KEEPS L3: the version moves with the law); PIN MOVED: acct179, STAFF-PANEL 0.2.3 (the staff panel's five features folded: Set bank, the Banned tab and ban filter, Hide me a toggle off by default, the chat's Me / Red switch and the in-game staff view; acct177 on their branches, renumbered past ACCOUNT-HOMES and GUNS-UNFOUND at the fold; migrations 0164-0165); PIN MOVED: acct178, GUNS-UNFOUND (item law 12: the Hourlock a gilded Dwarven Long Bow, the Sunken Sovereign the Ebony Saber again, the guns minted before lawful as their eras; acct177 on its branch, renumbered past ACCOUNT-HOMES at the merge); PIN MOVED: acct177, ACCOUNT-HOMES and GUILD-HALL-SALE (the homes of an account every character's, a deleted character's homes released, a guild's hall sold at its door; acct90 and migration 0087 on its branch, renumbered past main's acct91-acct176 and migrations 0087-0162 at its merge; migration 0163); PIN MOVED: acct176, STAFF-PANEL-SPEED (the staff panel pages answer in fewer database round trips: reads and the audit row folded together, two indexes; migrations 0161-0162); PIN MOVED: acct175, STAFF-PANEL5 (the staff panel relay half: follow tokens, Message on screen, the staff feeds, hidden staff, freeze and staff chat; acct174 on its branch, renumbered past STAFF-PANEL2-6 at its merge; migrations 0157-0160); PIN MOVED: acct174, STAFF-PANEL2-6 (the staff panel server side: reports and claims, Mute and Ban from the panel, notes, watchlist, settings, server notice, players, trade holds, item removals, economy, census, status tiles and Home; acct171 on its branch, then acct172, renumbered past AUDIT COLLECTIONS-II, SEA VENTURES and LOST-SPOILS at the merges; migrations 0149-0156); PIN MOVED: acct173, LOST-SPOILS (a boss's floor's leftovers to the post from the Lost and Found - /v1/post/lost; acct168 on its branch, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET, AUDIT COLLECTIONS-II and SEA VENTURES at the merge; no migration); PIN MOVED: acct172, SEA VENTURES (acct168 on its branch, then acct169, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET and AUDIT COLLECTIONS-II at the merges - the Eltheric Ocean ventures, one release: item law 11 and the nine records of the Eltheric Tidemail; the season boards of the sea, its bounties and the prizes of its wrecks; migrations from 0146); PIN MOVED: acct171, AUDIT COLLECTIONS-II (the glyph and icon doors answer the honours and the titles of a Charter; acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge); PIN MOVED: acct170, PISTOLET (the item law moved to 10 - the Dwarven Pistolet known to the judge, the Sunken Sovereign lawful as a gilded Pistolet and as the saber minted before; acct168 on its branch, renumbered past STAFF-PANEL1 and CRAFT-PAYS at the merge); PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release (a Novice brew answers two potions; the crafting writs - craftWrits.js, /v1/writs/craft, migration 0145; acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge); PIN MOVED: acct168, STAFF-PANEL1 (the staff panel sign-in - a password, a key only the Staff Panel extension holds and the role lists; staff keys, invites, sessions and an append-only audit, migration 0144); PIN MOVED: acct167, CAKE-CAP-SAID (a festival find answers the cakes found that day, and capped once they are all found; the account festival answers them too; acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge); PIN MOVED: acct166, ESSENCE-LOOSE (Arcane Essence of a piece made of loose goods is loose, never gold, and the Reforge spends it; migration 0142) and SOUL-LAW (item law 9 - a soul of the Enemy Expansion fifty lawful in a Soul Gem or Azura Star; migration 0143 lifts the holds law 8 laid on one), one release; PIN MOVED: acct165, WITCH1 (the Witches Festival - Soul Cakes, the Wyrd Sister sales, the Hearth Offerings, the profile icon) and STAR7 (the fallen stars held - /v1/star/claim, the star_spoils and stars_held of migration 0141, the star under the combat cap), one release; PIN MOVED: acct164, LEAN-READS (the account database's scans taken away, a slow database shed; migrations 0135-0139; acct159, acct160, acct161, acct162 then acct163 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges); PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP (staff mend a purse below nothing - realm-mend, the hold it made lifted - and a death in the zone takes the packs at the side off the record, a tab that never says it reads them refused; acct162 on its branch, renumbered past the acct162 of NAME-WORDS at the merge); PIN MOVED: acct162, NAME-WORDS (the name filter reads two more words anywhere - a handle holding either is refused; migration 0134 renames the account that held them); PIN MOVED: acct161, JUNGLE-WOODS (a jungle pixel stands 48 trees a day, every slot a tree, the service counting them as the law does; acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges); PIN MOVED: acct160 - acct159 on its branch, renumbered past the acct159 of QL12 at the merge
  assert.match(read('server-account/wrangler.toml'), /^ACCOUNT_VERSION = "acct194"$/m);   // PIN MOVED: acct194, NIRNROOT-SAGE (NIRNROOT_SAGE_HANDLES grants Blob-Marley a title, its glyph and an aura); PIN MOVED: acct193, COPY-LIFT (FIELD BUGS 2026-10-25i: the staff purge with keep keeps one of each copied piece and lifts its lock in the same batch; acct191 on its branch, renumbered past YARD-TOWN acct191 and ECON-LEFT-OUT acct192 on main at the merge); PIN MOVED: acct192, ECON-LEFT-OUT and ECON-WORTH (acct192 on its branch, renumbered past main's acct192-acct191 at the merge; the staff Economy keeps banned and trade-held characters out of its gold totals and adds the game worth; the census tally keeps the bank share); PIN MOVED: acct185, CLOTH-GEMS (the loom weaves Linen and spins Wool, AUDIT 32 S1 judges the units, the jeweller sets every grade of gem; acct182 on its branch, renumbered past STAFF-EVENT, AUDIT HIDDEN-UNCOUNTED and STAFF-EVENT BOSS at the merge); PIN MOVED: acct184, STAFF-EVENT BOSS (an exact boss health hp staged, and clear takes an event that is over off the list); PIN MOVED: acct183, AUDIT HIDDEN-UNCOUNTED (a hidden staff member reads offline in their guild, last online the moment they hid; the reader's own row marked hidden; acct182 on its branch, renumbered past STAFF-EVENT at the merge); PIN MOVED: acct182, STAFF-EVENT (staff events from the panel - staged, ended, the mini boss called, the meters read; migration 0167; acct181 on its branch, renumbered past KETCH at the merge); PIN MOVED: acct181, KETCH (the sky-ketch Mzunthar, a weekly raid of eight - its claim and migration 0166; item law 13 - the airship gilded pair lawful; acct180 on its branch, renumbered past FOE-KEEPS' acct180 at the merge); PIN MOVED: acct180, FOE-KEEPS (a death to a foe refused and a kill taking a tenth; AUDIT FOE-KEEPS L3: the version moves with the law); PIN MOVED: acct179, STAFF-PANEL 0.2.3 (the staff panel's five features folded: Set bank, the Banned tab and ban filter, Hide me a toggle off by default, the chat's Me / Red switch and the in-game staff view; acct177 on their branches, renumbered past ACCOUNT-HOMES and GUNS-UNFOUND at the fold; migrations 0164-0165); PIN MOVED: acct178, GUNS-UNFOUND (item law 12: the Hourlock a gilded Dwarven Long Bow, the Sunken Sovereign the Ebony Saber again, the guns minted before lawful as their eras; acct177 on its branch, renumbered past ACCOUNT-HOMES at the merge); PIN MOVED: acct177, ACCOUNT-HOMES and GUILD-HALL-SALE (the homes of an account every character's, a deleted character's homes released, a guild's hall sold at its door; acct90 and migration 0087 on its branch, renumbered past main's acct91-acct176 and migrations 0087-0162 at its merge; migration 0163); PIN MOVED: acct176, STAFF-PANEL-SPEED (the staff panel pages answer in fewer database round trips: reads and the audit row folded together, two indexes; migrations 0161-0162); PIN MOVED: acct175, STAFF-PANEL5 (the staff panel relay half: follow tokens, Message on screen, the staff feeds, hidden staff, freeze and staff chat; acct174 on its branch, renumbered past STAFF-PANEL2-6 at its merge; migrations 0157-0160); PIN MOVED: acct173, LOST-SPOILS (a boss's floor's leftovers to the post from the Lost and Found - /v1/post/lost; acct168 on its branch, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET, AUDIT COLLECTIONS-II and SEA VENTURES at the merge; no migration); PIN MOVED: acct172, SEA VENTURES (acct168 on its branch, then acct169, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET and AUDIT COLLECTIONS-II at the merges - the Eltheric Ocean ventures, one release: item law 11 and the nine records of the Eltheric Tidemail; the season boards of the sea, its bounties and the prizes of its wrecks; migrations from 0146); PIN MOVED: acct171, AUDIT COLLECTIONS-II (the glyph and icon doors answer the honours and the titles of a Charter; acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge); PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release (a Novice brew answers two potions; the crafting writs - craftWrits.js, /v1/writs/craft, migration 0145; acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge); PIN MOVED: acct168, STAFF-PANEL1 (the staff panel sign-in - a password, a key only the Staff Panel extension holds and the role lists; staff keys, invites, sessions and an append-only audit, migration 0144); PIN MOVED: acct167, CAKE-CAP-SAID (a festival find answers the cakes found that day, and capped once they are all found; the account festival answers them too; acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge); PIN MOVED: acct166, ESSENCE-LOOSE (Arcane Essence of a piece made of loose goods is loose, never gold, and the Reforge spends it; migration 0142) and SOUL-LAW (item law 9 - a soul of the Enemy Expansion fifty lawful in a Soul Gem or Azura Star; migration 0143 lifts the holds law 8 laid on one), one release; PIN MOVED: acct164, LEAN-READS (the account database's scans taken away, a slow database shed; migrations 0135-0139; acct159, acct160, acct161, acct162 then acct163 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges)
});
