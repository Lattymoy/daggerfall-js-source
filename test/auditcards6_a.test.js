// AUDIT CARDS-6 (2026-10-09, bible/01-Overview/Audit-Cards-6.md) lane A: WHERE CARDS COME FROM, AUDITED - their worth,
// their customs, their sources. A sealed pack is counted at its worth by the customs and both of the service's bounds,
// taken as a card, and none at a birth (A1); a card or a pack standing as the owner's own decor is counted and taken,
// its piece with it (A2); a joiner's copy of a body draws for its own card at both copy doors (A3, the real doors run);
// a temple's hall that is its templar order pays its divine's card (A4, the host's block run); the pack's lines show
// (A5); a card split off a stack and one in any list a load reads is worth its card (A6); a boss's card off the floor
// is said by its own name (A7); the card's picture is drawn last in its hoard, every earlier record what the seed gave
// it before CARDS9 (A8); within a worth customs takes the copies no deck needs first, and says a deck it broke (A9); and
// the quest card's once is a character's, not a session's (the lane's latent, the host's block run).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import {
  CARD_WORTH, cardWorth, cardWorthOf, cardRecordWorth, isCardRecord, isPackRecord, cardPacksOf, decorOwnOf, deckShortOf,
  STARTER_DECK_WORTH, customsCardAllowance, CARD_PACK_WORTH, CARD_PACK_TEMPLATE as LAW_PACK_TEMPLATE,
} from '../src/net/cardWorthLaw.js';
import {
  CARD_PACK_TEMPLATE, CARD_PACK_LINES, mintIliacCard, mintCardPack, isIliacCard, iliacCardName, giveBinderAtChargen, binderOf,
  binderDecks, setBinderDeck, deckHeldRefusal,
} from '../src/systems/iliacItems.js';
import {
  CARD_PACK_SIZE, PACK_POOL, PACK_SLOT_TIERS, PACK_TOP_TIERS, buyCardPack, dropFoeCard, guildNameOfFaction, guildCardRoll,
} from '../src/systems/cardSources.js';
import { STARTER_DECK, cardById } from '../src/net/iliacCards.js';
import { applyCustoms, cardCustoms, customsLines } from '../src/systems/realmCustoms.js';
import { firstSaveRefusal } from '../server-account/src/realm.js';
import { takeSceneOwn } from '../src/systems/sceneCache.js';
import { capFoeLoot } from '../src/systems/foeLootCap.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { validFoeRecord } from '../src/net/wire.js';
import { DIVINES, ORDERS, createGuildForGroup } from '../src/systems/guildVariants.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { activeMemberships } from '../src/systems/guilds.js';
import { addItem, splitStack } from '../src/systems/inventory.js';
import { itemInfoRows, itemStatRows } from '../src/systems/itemInfo.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createSpoilsPool, spoilsList, SPOILS_TEXT } from '../src/scenes/spoilsPool.js';
import { sdSpoilsList } from '../src/systems/sdSpoils.js';
import { seededRng } from '../src/systems/wind.js';
import { RANDOM_TREASURE_ICONS } from '../src/systems/loot.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const packsIn = (list) => (list ?? []).filter(isPackRecord).reduce((s, it) => s + (it.stackCount ?? 1), 0);
const customsRow = (level) => ({ origin_id: 'offline-id', summary: JSON.stringify({ level }) });
const born = () => { const e = { level: 1, goldPieces: 100, items: [] }; giveBinderAtChargen(e); return e; };
/** Math.random answering `v` for the length of `fn` (the death handler's draw is the module's own Math.random). */
const withRandom = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };

test('AUDIT CARDS-6 A1: a sealed pack is counted at its worth - the mean of what its five cards come to - by the cards\' customs and both of the service\'s bounds; customs takes it as a card, the dearest first; a character born online holds none (mutants: the pack uncounted; its worth; customs blind to it; the birth\'s pack)', () => {
  assert.equal(LAW_PACK_TEMPLATE, CARD_PACK_TEMPLATE, 'one number for the pack, the law\'s');
  assert.equal(CARD_PACK_TEMPLATE, 583);
  // the worth: four slots and a top, each tier at its worth (every card of a pack's pool is its tier's worth)
  for (const [t, ids] of Object.entries(PACK_POOL)) for (const id of ids) assert.equal(cardWorth(id), CARD_WORTH[t], id);
  const perMille = (table) => Object.entries(table).reduce((s, [t, w]) => s + w * CARD_WORTH[t], 0);
  const mean = ((CARD_PACK_SIZE - 1) * perMille(PACK_SLOT_TIERS) + perMille(PACK_TOP_TIERS)) / 1000;
  assert.equal(mean, 170.05);
  assert.equal(CARD_PACK_WORTH, Math.ceil(mean), 'the mean, rounded up to the gold');
  assert.equal(cardRecordWorth(mintCardPack(3)), 3 * CARD_PACK_WORTH, 'the stack counts');
  assert.equal(isCardRecord(mintCardPack()), false, 'a pack is no card (the cap, a deck)');
  // an honest offline level-5 character: the gift, twenty packs bought at the tavern and two hundred in the wagon
  const offline = { level: 5, goldPieces: 100_000, items: [], wagonItems: [mintCardPack(200)], bankAccounts: [] };
  giveBinderAtChargen(offline);
  for (let i = 0; i < 20; i++) assert.equal(buyCardPack(offline, { quality: 10 }).ok, true);
  offline.goldPieces = 0;
  assert.equal(cardPacksOf(offline), 220);
  assert.equal(cardWorthOf(offline), STARTER_DECK_WORTH + 220 * CARD_PACK_WORTH, 'every list counts the packs');
  assert.deepEqual(firstSaveRefusal(JSON.stringify(offline), customsRow(5)), { error: 'customs-cards' }, 'the service counts them');
  const copy = structuredClone(offline);
  const rep = applyCustoms(copy);
  const fit = Math.floor((customsCardAllowance(5) - STARTER_DECK_WORTH) / CARD_PACK_WORTH);   // 4
  assert.equal(rep.cardsKept, 220 - fit);
  assert.deepEqual([packsIn(copy.wagonItems), packsIn(copy.items)], [0, fit], 'the wagon\'s before the pack\'s, one at a time');
  assert.ok(cardWorthOf(copy) <= customsCardAllowance(5));
  assert.equal(firstSaveRefusal(JSON.stringify(copy), customsRow(5)), null, 'what customs left, the service takes');
  assert.equal(deckHeldRefusal(STARTER_DECK, copy.items), null, 'the starter deck untouched');
  assert.ok(customsLines(rep).some((l) => l === `Your cards are worth ${STARTER_DECK_WORTH + 220 * CARD_PACK_WORTH} gold; the realm lets a character of this level bring ${customsCardAllowance(5)}. ${220 - fit} cards, the dearest, stayed with your offline character.`), customsLines(rep).join(' | '));
  assert.equal(packsIn(offline.wagonItems) + packsIn(offline.items), 220, 'the offline character keeps every pack');
  // among the cards by its worth: two packs (342) dearer than four Liches (300), the dearest first
  const mixed = { level: 1, items: [mintIliacCard('lich', 4), mintCardPack(2)] };
  assert.deepEqual(cardCustoms(mixed), { kept: 2, worth: 300 + 2 * CARD_PACK_WORTH, allowance: customsCardAllowance(1) });
  assert.deepEqual(mixed.items.map((it) => [isPackRecord(it) ? 'pack' : it.card, it.stackCount]), [['lich', 4]]);
  // a character born online: the gift crosses; a pack beside it never - nor one where cards were dropped to make room
  assert.equal(firstSaveRefusal(JSON.stringify(born()), { origin_id: null }), null);
  const more = born();
  more.items.push(mintCardPack());
  assert.deepEqual(firstSaveRefusal(JSON.stringify(more), { origin_id: null }), { error: 'realm-birth' });
  const thin = born();
  thin.items = thin.items.filter((it) => !(isIliacCard(it) && cardById(it.card).tier === 'magic'));
  thin.items.push(mintCardPack());
  assert.ok(cardWorthOf(thin) <= STARTER_DECK_WORTH, 'within the gift\'s worth');
  assert.deepEqual(firstSaveRefusal(JSON.stringify(thin), { origin_id: null }), { error: 'realm-birth' }, 'chargen hands no pack, whatever the worth');
});

test('AUDIT CARDS-6 A2: a card or a pack standing as the owner\'s own decor (DECOR2a decorOwn) is counted by the customs and the service, and taken first among its worth - the item stays offline and its piece goes with it; nothing comes back to the pack online (mutants: the decor uncounted; untaken; its piece left standing)', () => {
  const snap = { level: 1, items: [], sceneCache: { scenes: [{ sceneName: 'house-1', decorOwn: {}, decor: [] }], permanentScenes: ['house-1'] } };
  giveBinderAtChargen(snap);
  const sc = snap.sceneCache.scenes[0];
  for (let i = 0; i < 6; i++) { sc.decorOwn[`p${i}`] = mintIliacCard(i % 2 ? 'valkynaz-ruhn' : 'sanguine-rose'); sc.decor.push({ id: `p${i}`, item: { t: 581 } }); }
  sc.decorOwn.pk = mintCardPack(2);
  sc.decor.push({ id: 'pk', item: { t: 583 } }, { id: 'chair', paid: 40 });
  assert.equal(decorOwnOf(snap).length, 7);
  const worth = STARTER_DECK_WORTH + 3 * CARD_WORTH.aetheric + 3 * CARD_WORTH.artifact + 2 * CARD_PACK_WORTH;
  assert.equal(cardWorthOf(snap), worth, 'the decor counts');
  assert.equal(cardPacksOf(snap), 2);
  assert.deepEqual(firstSaveRefusal(JSON.stringify(snap), customsRow(1)), { error: 'customs-cards' }, 'and the service counts it');
  const copy = structuredClone(snap);
  const rep = applyCustoms(copy);
  const room = copy.sceneCache.scenes[0];
  assert.equal(rep.cardsKept, 8, 'six cards and two packs');
  assert.deepEqual(Object.keys(room.decorOwn), [], 'none of the owner\'s cards stand in the realm\'s copy');
  assert.deepEqual(room.decor.map((p) => p.id), ['chair'], 'their pieces gone with them - a bought piece stays');
  assert.equal(cardWorthOf(copy), STARTER_DECK_WORTH, 'the gift crosses whole: the decor went first');
  assert.equal(firstSaveRefusal(JSON.stringify(copy), customsRow(1)), null);
  // online, the house sold: nothing of them comes back to the pack
  const back = takeSceneOwn({ scenes: new Map([[room.sceneName, room]]) }, room.sceneName);
  assert.deepEqual(back, []);
  assert.equal(Object.keys(snap.sceneCache.scenes[0].decorOwn).length, 7, 'the offline character keeps every piece');
});

// ── A3: the dungeon's copy doors, run ─────────────────────────────────────────────────────────────────────────────

const DC = read('src/scenes/dungeonContext.js');
const AST = acorn.parse(DC, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const srcOf = (n) => { assert.ok(n); return DC.slice(n.start, n.end); };
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const ratBody = () => ({ mobileType: MOBILE_TYPES.Rat, level: 1, items: [], lootCap: 3, health: 0, maxHealth: 5, activeEffects: [], stats: {}, career: {}, skills: {} });
/** The copy doors' own deps - the kit, the food and the sigils stand in; the card and the cap are the real ones. */
const doorDeps = () => ({
  rollCorpseKit: () => [], addCorpseFood: () => {}, stampWonWeapons: () => 0, dropFoeCard, capFoeLoot,
  liveStat: () => 50, playerEntity: { isPlayer: true, items: [] },
});

test('AUDIT CARDS-6 A3: a joiner\'s copy of a body - the stream\'s death of it and an arrival\'s body the room hands without its list - draws for its own card before its cap, as the host\'s death does; the room adopts the first opener\'s list, so a joiner who opened it first no longer hands the room a body with no card (mutants: either door\'s card)', () => {
  // the stream's death: applyFoeRecord, run on a joiner
  const foes = [{ mobileType: MOBILE_TYPES.Rat, dead: false, gender: 'male', entity: ratBody(), ai: { feet: [0, 0, 0], yaw: 0, isHostile: true, target: null } }];
  const state = {
    ...doorDeps(), foes, _layoutFoes: 1, _retyping: new Set(), _authority: false, validFoeRecord, opts: { selfId: () => 'peer-7' },
    renownFoeDied: () => {}, reportPlayerKill: () => {}, sayEnemyDied: () => null, hudText: { add: () => {} },
    setFoeDead: (f, d) => { f.dead = d; }, retypeFoe: async () => false,
  };
  const api = mount(`${srcOf(find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === 'REMOTE_KILL')))}
    ${srcOf(find((x) => x.type === 'FunctionDeclaration' && x.id?.name === 'applyFoeRecord'))} return { applyFoeRecord };`, state);
  withRandom(0, () => api.applyFoeRecord(foes[0], { i: 0, d: 1, f: [0, 0, 0] }));
  assert.equal(foes[0].dead, true);
  assert.deepEqual(foes[0].entity.items.filter(isIliacCard).map((c) => c.card), ['rat'], 'the copy\'s own card, kept by the cap');
  withRandom(0, () => api.applyFoeRecord(foes[0], { i: 0, d: 1, f: [0, 0, 0] }));
  assert.equal(foes[0].entity.items.length, 1, 'once - the next frame finds it dead');
  // a draw that misses: none
  const miss = [{ ...foes[0], dead: false, entity: ratBody() }];
  const m = mount(`${srcOf(find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === 'REMOTE_KILL')))}
    ${srcOf(find((x) => x.type === 'FunctionDeclaration' && x.id?.name === 'applyFoeRecord'))} return { applyFoeRecord };`, { ...state, foes: miss });
  withRandom(0.99, () => m.applyFoeRecord(miss[0], { i: 0, d: 1, f: [0, 0, 0] }));
  assert.deepEqual(miss[0].entity.items, []);
  // an arrival's body the room's memory hands without its list: patchFoe's copy arm, run
  const arm = srcOf(find((x) => x.type === 'IfStatement' && DC.slice(x.test.start, x.test.end) === 'wire && sf.dead && !f.dead && sf.items == null'));
  const body = (wire, sf) => {
    const f = { dead: false, entity: ratBody() };
    withRandom(0, () => mount(`${arm} return f;`, { ...doorDeps(), wire, sf, f }));
    return f.entity.items.filter(isIliacCard).map((c) => c.card);
  };
  assert.deepEqual(body(true, { dead: true, items: null }), ['rat'], 'the arrival\'s copy draws its own');
  assert.deepEqual(body(true, { dead: true, items: [] }), [], 'a room\'s list is the room\'s');
  assert.deepEqual(body(false, { dead: true, items: null }), [], 'a save off disk carries its own');
});

// ── A4 and the latent: the host's quest card, run ──────────────────────────────────────────────────────────────────

const W = read('src/scenes/world.js');
const QUEST_BLOCK = W.slice(W.indexOf('  const cardQuestPaid = new Set();'), W.indexOf('\n  };\n', W.indexOf('  const cardQuestEnded = (q) => {')) + 5);
/** world.js's quest-card block over a fake host - the real cards, the real memberships, the real roll (a sure draw). */
function questHost({ dict = null, memberships = {} } = {}) {
  const playerEntity = { characterId: 'char-A', items: [], guildMemberships: { mortal: memberships, vampire: {} } };
  const said = [];
  const scope = {
    playerEntity, townTalk: { say: (l) => said.push(l), factionDict: dict }, activeMemberships, guildNameOfFaction, guildCardRoll,
    mintIliacCard, addItem, iliacCardName, Math: { ...Math, random: () => 0 },
  };
  const api = new Function(...Object.keys(scope), `${QUEST_BLOCK}\nreturn { cardQuestEnded };`)(...Object.values(scope));
  const cards = () => playerEntity.items.filter(isIliacCard).map((c) => c.card);
  return { ...api, playerEntity, said, cards };
}

test('AUDIT CARDS-6 A4: a temple\'s quest from a hall whose faction is its templar order (the Order of the Hour, under Akatosh) pays its divine\'s card - Temple.GetDivine\'s own walk through the faction table, which the host hands the roll; an order has no walk (mutants: no walk; the host\'s table unread)', () => {
  const HOUR = 92;
  const dict = new Map([[HOUR, { id: HOUR, parent: DIVINES.Akatosh, name: 'The Order of the Hour' }], [999, { id: 999, parent: ORDERS.Rose }]]);
  assert.equal(createGuildForGroup(GUILD_GROUPS.HolyOrder, HOUR, dict)?.name, 'Temple:Akatosh', 'the hall is Akatosh\'s temple');
  assert.equal(guildNameOfFaction(HOUR, dict), 'Temple:Akatosh');
  assert.equal(guildNameOfFaction(DIVINES.Akatosh, dict), 'Temple:Akatosh', 'the divine\'s own id, as before');
  assert.equal(guildCardRoll(HOUR, 0, () => 0, dict), 'priest-of-akatosh');
  assert.equal(guildNameOfFaction(HOUR), null, 'no table, no walk');
  assert.equal(guildNameOfFaction(999, dict), null, 'KnightlyOrder.GetOrder walks no parent');
  assert.equal(guildNameOfFaction(ORDERS.Rose, dict), 'Order:Rose');
  // the host pays it: a member of Akatosh's temple, the hall's quest done
  const h = questHost({ dict, memberships: { [GUILD_GROUPS.HolyOrder]: { guild: 'Temple:Akatosh', rank: 3 } } });
  h.cardQuestEnded({ uid: 11, questSuccess: true, factionId: HOUR });
  assert.deepEqual(h.cards(), ['priest-of-akatosh']);
  assert.deepEqual(h.said, ['The guild adds a card to your reward: Priest of Akatosh.']);
});

test('AUDIT CARDS-6 (the lane\'s latent): the quest card\'s once is a character\'s - another character loaded in place, its own restored quest at a uid the first was paid for, is paid; the same character\'s same quest heard again is not (mutant: the bare uid)', () => {
  const h = questHost();
  h.cardQuestEnded({ uid: 5, questSuccess: true, factionId: 40 });
  assert.deepEqual(h.cards(), ['mages-guild-apprentice']);
  h.cardQuestEnded({ uid: 5, questSuccess: true, factionId: 40 });
  assert.equal(h.cards().length, 1, 'its end heard again: once');
  // an offline load restores another character into the one entity (save.js restorePlayer), its quests at their own uids
  h.playerEntity.characterId = 'char-B';
  h.playerEntity.items = [];
  h.cardQuestEnded({ uid: 5, questSuccess: true, factionId: 40 });
  assert.deepEqual(h.cards(), ['mages-guild-apprentice'], 'the second character\'s quest pays');
  h.cardQuestEnded({ uid: 6, questSuccess: false, factionId: 40 });
  assert.equal(h.cards().length, 1, 'a failed quest pays none, as ever');
});

test('AUDIT CARDS-6 A5: the sealed pack\'s lines show - on the classic window\'s info box and the enhanced item card (mutants: either gate)', () => {
  const pack = mintCardPack(3);
  const rows = (id) => [{ text: `<TEXT.RSC record ${id}>` }];
  assert.deepEqual(itemInfoRows(pack, rows).map((r) => r.text), ['Card Pack', 'Weight: 0.00 kilograms', ...CARD_PACK_LINES]);
  const stat = itemStatRows(pack).map((r) => r.text);
  for (const line of CARD_PACK_LINES) assert.ok(stat.includes(line), `${line} | ${stat.join(' | ')}`);
});

test('AUDIT CARDS-6 A6: a card\'s value is its worth - one split off a stack (it took the template\'s coin), and one in any list a load reads (the load refreshed the pack\'s alone): the wagon, the bag, a house chest (mutants: the split\'s coin; the load\'s pack alone)', () => {
  const list = [mintIliacCard('lich', 3)];
  const picked = splitStack(list, list[0], 1);
  assert.deepEqual([picked.card, picked.value, list[0].value], ['lich', 75, 75]);
  // a save from before CARDS9: every card a coin
  const old = (id) => { const c = mintIliacCard(id); c.value = 1; return c; };
  const ent = { items: [old('lich')], wagonItems: [old('giant')], bagItems: [], level: 1 };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(ent)));
  snap.wagonItems = [old('giant')];
  snap.sceneCache = { scenes: [{ sceneName: 'house-1', lootContainers: [{ items: [old('ancient-lich')] }] }] };
  const back = { items: [], wagonItems: [] };
  restorePlayer(back, snap);
  assert.deepEqual(back.items.filter(isIliacCard).map((c) => c.value).slice(0, 1), [75], 'the pack\'s');
  assert.deepEqual(back.wagonItems.filter(isIliacCard).map((c) => c.value), [75], 'the wagon\'s');
  assert.deepEqual(snap.sceneCache.scenes[0].lootContainers[0].items.map((c) => c.value), [300], 'a house chest\'s, in the save the scene cache is restored from');
});

test('AUDIT CARDS-6 A7: a boss\'s card taken off the spoils floor is said by its own name - "Card: Valkynaz Ruhn", the plaque\'s and the pack\'s - and every other piece by its own as before (mutant: the stored name)', () => {
  const list = spoilsList(0, 10);
  const card = list.find((p) => p.item?.templateIndex === 581);
  assert.equal(card?.item.card, 'valkynaz-ruhn', 'the Gate\'s hoard at seed 0 carries the Warden\'s card');
  const said = [];
  const mem = new Map();
  const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k) };
  const p = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store, who: () => 'c', wall: () => 1, say: (t) => said.push(t) });
  assert.equal(p.spew({ day: 3, seed: 0, level: 10, at: [0, 2, 0], bearing: 0, acct: 'acc', roll: () => list }), true);
  p.gather();
  assert.ok(said.includes(SPOILS_TEXT.item('Card: Valkynaz Ruhn', 'aetheric')), said.join(' | '));
  assert.ok(said.includes('You take Card: Valkynaz Ruhn (Aetheric).'));
  assert.ok(!said.some((l) => /You take Card \(/.test(l)));
  const ember = list.find((q) => q.item?.name === 'Deadlands Ember');
  assert.ok(said.includes(SPOILS_TEXT.item(ember.item.name, ember.tier)), 'a piece that is no card: its own name');
});

test('AUDIT CARDS-6 A8: the card\'s picture is drawn LAST in its hoard - every earlier record (the pieces\', the ember\'s, the gold pile\'s) the look-stream\'s draw for it before CARDS9 - in the Gate\'s list and the Abyss\'s (mutants: the card before the gold, in either)', () => {
  const icon = (look) => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
  let gate = 0, abyss = 0;
  for (let seed = 0; seed < 400; seed++) {
    const s = (seed * 2654435761) >>> 0, lv = 1 + (seed % 40);
    for (const [name, list, look] of [
      ['gate', spoilsList(s, lv), seededRng((s ^ 0x5eed) >>> 0)],
      ['abyss', sdSpoilsList(s, lv), seededRng(((s >>> 0) ^ 0x5eed) >>> 0)],
    ]) {
      const cards = list.filter((p) => p.item?.templateIndex === 581);
      const rest = list.filter((p) => p.item?.templateIndex !== 581);
      for (const p of rest) assert.equal(p.record, icon(look), `${name} seed ${s}: ${p.kind} ${p.item?.name ?? ''}`);
      for (const c of cards) assert.equal(c.record, icon(look), `${name} seed ${s}: the card, last`);
      if (cards.length && name === 'gate') gate++;
      if (cards.length && name === 'abyss') abyss++;
    }
  }
  assert.ok(gate > 40 && abyss > 40, `the card came in enough hoards to say so (${gate}, ${abyss})`);
});

test('AUDIT CARDS-6 A9: within a worth, customs takes the copies no deck needs first - the found cards and the spare copies before the starter deck\'s - so the binder\'s decks stay held; a deck it must still break is said (mutants: every copy spare; the line unsaid)', () => {
  // the gift and four each of four found magic cards (two of them the starter deck names once): 285 + 320 against 435
  const snap = { level: 1, items: [] };
  giveBinderAtChargen(snap);
  for (const id of ['centaur', 'werewolf', 'lamia', 'gargoyle']) snap.items.push(mintIliacCard(id, 4));
  const before = structuredClone(snap);
  const rep = applyCustoms(snap);
  assert.equal(rep.cardsKept, 9, '170 over, at 20 a card');
  const deck = binderDecks(binderOf(snap.items))[0];
  assert.equal(deck.name, 'Starter Deck');
  assert.equal(deckHeldRefusal(deck.cards, snap.items), null, 'the starter deck still held');
  assert.equal(deckShortOf(snap, deck.cards), null, 'and the ranked seat\'s word with it');
  assert.equal(rep.decksShort, 0);
  const count = (items, id) => items.filter((it) => isIliacCard(it) && it.card === id).reduce((s, it) => s + it.stackCount, 0);
  // in the pack's order, spares only: the gift's spare Centaur and Lamia, three more Centaurs (the deck's one kept), the
  // four Werewolves - nine; the Lamias and Gargoyles past them were not needed
  assert.deepEqual(['centaur', 'werewolf', 'lamia', 'gargoyle'].map((id) => count(snap.items, id)), [1, 0, 4, 4]);
  for (const id of STARTER_DECK.filter((x) => cardById(x).tier === 'magic' && !['centaur', 'lamia'].includes(x))) assert.equal(count(snap.items, id), count(before.items, id), `${id}: untouched`);
  // a deck customs must break - its Ancient Lich the dearest card held - is said
  const two = { level: 1, items: [] };
  giveBinderAtChargen(two);
  two.items.push(mintIliacCard('ancient-lich'), mintIliacCard('lich', 2));
  assert.equal(setBinderDeck(binderOf(two.items), 1, { name: 'Lich Deck', cards: [...STARTER_DECK.slice(1), 'ancient-lich'] }), true);
  const r2 = applyCustoms(two);
  assert.equal(r2.cardsKept, 1);
  assert.equal(r2.decksShort, 1, 'the Lich Deck names a card that stayed');
  assert.ok(customsLines(r2).includes('One deck in your binder names cards that stayed behind; the table deals a deck only when your binder holds every card it names.'), customsLines(r2).join(' | '));
  assert.ok(customsLines(r2, { before: true }).includes('One deck in your binder will name cards that stay behind; the table deals a deck only when your binder holds every card it names.'));
  assert.ok(!customsLines(rep).some((l) => /deck in your binder/.test(l)), 'none broken, nothing said');
});
