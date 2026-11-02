// FIELD BUGS 2026-09-30b (BANK-REGION) - Guppy in #support, online: "is it normal when u become a werewolf you loose the
// gold in your bank and u have to rejoin fighters guild~?"
//
// THE CURSE TOOK NOTHING. The turn walked on the real tick - the bite, the dream, the turn, the beast and back, a save
// and a load - leaves every account, every loan and the Fighters Guild rank where they stood, as DFU's does: lycanthropy
// swaps no guild book (vampirism alone does - GuildManager.Memberships, guilds.js activeMemberships - and a cure gives it
// back) and nothing in the curse touches a bank.
//
// WHAT THE PLAYER MET WAS THE BANK. Online every bank is "The Bank of the Empire" (EMPIRE-BANK) and the Empire is one
// lender, but a deposit still lives in the account of the region it was made in (systems/banking.js, THE STORE IS PER
// REGION). The Enhanced Plus teller in another region read "Bank of the Empire / Wayrest / Account balance 0" - no word
// of whose account that was or where the gold stood; the one list of every region's account (CreateBankingStatusBox)
// opens only from the classic sheet's gold button. The teller's row names its region now, and each other region holding
// gold stands beneath it, in both lanes. The classic parchment is DFU's and unchanged.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startInfection, INFECTION, liveInfection, VAMPIRE_CLANS } from '../../src/systems/infection.js';
import { liveLycanthropy, morphSelf } from '../../src/systems/lycanthropy.js';
import { createVampirismCurse, cureVampirism } from '../../src/systems/vampirism.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { setSpellRecordsByIndex } from '../../src/systems/loot/loot.js';
import { createBankAccounts, borrowLoan } from '../../src/systems/banking.js';
import { GUILDS, activeMemberships, joinGuild, membershipOf } from '../../src/systems/guild/guilds.js';
import { showsJoinButton } from '../../src/systems/guild/guildServiceFlow.js';
import { BankWindow } from '../../src/ui/bankWindow.js';
import { PORT_SPECS } from '../../src/ui/enhanced/enhancedPorts.js';

const DAGGERFALL = 17, BLUFFS = 3, WAYREST = 23, FG = GUILDS.FightersGuild, DAY = 1440;
setSpellRecordsByIndex(new Map([[92, { index: 92, name: '!Lycanthropy', effects: [] }],
  [4, { index: 4, name: 'Levitate' }], [90, { index: 90, name: 'Charm Mortal' }], [91, { index: 91, name: 'Calm Humanoid' }]]));

/** The page as the lane reads it: `?online` on the URL (systems/online/onlineLane.js isOnlinePage), or not. */
function lane(online, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: online ? '?online=1' : '' };
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
}
/** Guppy: a Fighters Guild Defender with gold banked in Daggerfall. */
function guppy() {
  const p = { isPlayer: true, name: 'Guppy', race: 'Nord', level: 10, activeEffects: [], health: 100, maxHealth: 100, fatigue: 5000,
    items: [], spells: [], stats: {}, skills: new Array(35).fill(60), skillUses: new Array(35).fill(0), goldPieces: 300 };
  p.bankAccounts = createBankAccounts();
  p.bankAccounts[DAGGERFALL].accountGold = 12345;
  joinGuild(activeMemberships(p), FG, { year: 405, dayOfYear: 10 });
  activeMemberships(p)[FG.guildGroup].rank = 4;
  return p;
}
const rank = (e) => membershipOf(activeMemberships(e), FG)?.rank ?? null;
/** The teller the host mounts (scenes/worldModes.js), in the Enhanced Plus face. */
const teller = (p, region, city) => PORT_SPECS.bank.view(new BankWindow({
  accounts: () => p.bankAccounts, regionIndex: () => region, level: () => p.level, now: () => 0,
  player: { gold: () => p.goldPieces, totalGold: () => p.goldPieces }, wagonGold: () => 0, rows: () => [],
  cityName: () => city, regionName: () => city, dueDateText: () => '',
}));
const rows = (v) => v.blocks[0].items.filter((i) => !/^Loan/.test(i[0]));

test('BANK-REGION the report: a teller in Wayrest names Wayrest\'s account and lists what Daggerfall and the Bluffs hold beneath it; in Daggerfall it names Daggerfall\'s and lists the others; online and offline alike (mutants: the region unnamed; the others unlisted; the account itself listed again; every empty account listed)', () => {
  const p = guppy();
  p.bankAccounts[BLUFFS].accountGold = 777;
  for (const online of [true, false]) {
    lane(online, () => {
      const away = teller(p, WAYREST, 'Wayrest');
      assert.equal(away.title, online ? 'Bank of the Empire' : 'Bank of Wayrest', 'EMPIRE-BANK\'s name stands');
      // EMPIRE-ACCOUNT (2026-10-01): online every branch keeps the Empire's one account (Daggerfall's index), and only a
      // branch not yet folded into it stands beneath; offline each region's own, as BANK-REGION shipped it
      assert.deepEqual(rows(away), online
        ? [['Empire account', '12345'], ['Banked in Daggerfall Bluffs', '777'], ['Gold carried', '300']]
        : [['Account in Wayrest', '0'], ['Banked in Daggerfall Bluffs', '777'], ['Banked in Daggerfall', '12345'], ['Gold carried', '300']],
        `${online ? 'online: the Empire\'s account at Wayrest' : 'offline: the 0 is Wayrest\'s'}, and the gold is still in the bank, where it was banked`);
      assert.deepEqual(rows(teller(p, DAGGERFALL, 'Daggerfall')), [[online ? 'Empire account' : 'Account in Daggerfall', '12345'], ['Banked in Daggerfall Bluffs', '777'], ['Gold carried', '300']],
        'at home: its own account once, the other region beneath');
    });
  }
  delete p.bankAccounts[BLUFFS].accountGold;   // a malformed account lists nothing and throws nothing
  assert.deepEqual(lane(true, () => rows(teller(p, DAGGERFALL, 'Daggerfall'))), [['Empire account', '12345'], ['Gold carried', '300']]);
});

test('BANK-REGION the curse takes nothing: the werewolf turn walked on the real tick (bite, dream, turn, the beast and back, a save and a load) keeps every account, the loan and the Fighters Guild rank, and the hall shows no Join; a vampire reads DFU\'s empty book and its cure gives the rank back (mutants: a werewolf reads the vampire book)', () => {
  const p = guppy();
  lane(true, () => borrowLoan(p.bankAccounts, DAGGERFALL, 5000, { level: p.level, nowMinutes: 0, online: true }));
  const before = JSON.stringify(p.bankAccounts);
  let t = 500 * DAY;
  startInfection(p, INFECTION.Werewolf, { day: Math.floor(t / DAY), regionIndex: DAGGERFALL });
  for (const m of [DAY + 10, 3 * DAY + 10]) { runMagicRoundsFor(p, t, t + m, { sinks: {} }); t += m; }
  assert.ok(liveLycanthropy(p) && !liveInfection(p), 'the turn came');
  assert.equal(morphSelf(p, { force: true, nowMinutes: t }).ok, true);
  assert.equal(rank(p), 4, 'a beast keeps its rank');
  morphSelf(p, { force: true, nowMinutes: t + 2 * DAY });
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: t + 2 * DAY }))));
  for (const e of [p, q]) {
    assert.equal(JSON.stringify(e.bankAccounts), before, 'every account and the loan as they were');
    assert.equal(rank(e), 4);
    assert.equal(showsJoinButton(activeMemberships(e), FG.guildGroup), false, 'the hall greets a member');
  }
  assert.ok(liveLycanthropy(q), 'and the load is still a werewolf');
  const v = guppy();
  createVampirismCurse(v, VAMPIRE_CLANS.Anthotis, { now: t });
  assert.deepEqual([rank(v), showsJoinButton(activeMemberships(v), FG.guildGroup), v.bankAccounts[DAGGERFALL].accountGold], [null, true, 12345],
    'DFU\'s vampire starts the guilds over - and keeps the bank');
  cureVampirism(v);
  assert.deepEqual([rank(v), showsJoinButton(activeMemberships(v), FG.guildGroup)], [4, false], 'the cure gives the book back');
});
