// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE GUILD WINDOW'S SHOP PAGE - each ware by who pays it, drawn, with
// its price in silver and who pays it, and Buy (a second press to be sure, as every silver spend in the window). An
// account's ware any member buys once; the guild's furniture the guildmaster buys from the silver treasury, up to its
// most. The page reads the shop at each turn to it (guildBook.js readShop); the service holds every rule and answers
// each refusal in the window's foot. Drawn through the window's own kit (ui/socialPanel.js), so it looks as its pages.
import { GUILD_SHOP_PAYERS } from '../../net/guild/guildShopLaw.js';
import { marksText } from '../../net/marksLaw.js';
import { guildWareName, guildWareLook, guildShopKindName, guildWarePayerText } from './guildShopText.js';
import { guildWareSvg } from './guildWareArt.js';
import { t } from '../../systems/textManager.js';

/** What to do with a ware once held - said under it, and after a purchase. */
export const guildWareUseText = (/** @type {unknown} */ key) => {
  switch (key) {
    case 'insigniaarmlet': return t('guild.shop.use.insigniaarmlet', 'Wear it from the Aura Armory, in the arms slot.');
    case 'guildcrest': return t('guild.shop.use.guildcrest', 'Choose it as your portrait icon in your profile.');
    case 'guildsails': return t('guild.shop.use.guildsails', 'Choose a pattern on a ship\'s Paint panel in the Fleet.');
    default: return t('guild.shop.use.furniture', 'Set it down in the guild hall with the decor tool.');
  }
};

/** Why a ware cannot be bought now, or null. AUDIT GUILD-RANKS C3: `v` the guild's view - a shop given to more ranks than
 *  the guildmaster's says so. */
export function guildWareWhy(/** @type {any} */ shop, /** @type {any} */ w, /** @type {any} */ v = null) {
  if (!shop?.open) return t('guild.shop.why.closed', 'silver is closed');
  if (w.payer === 'account') {
    if (w.held) return null;
    return Number(shop.marks) < w.price ? t('guild.shop.why.short', 'not enough silver') : null;
  }
  if (!shop.buysForGuild) return JSON.stringify(v?.powers?.shop ?? [0]) === '[0]' ? t('guild.shop.why.master', 'the guildmaster buys these') : t('social.guild.rankWhy', 'not your rank\'s');
  if (Number(w.owned) >= Number(w.max)) return t('guild.shop.why.max', 'the guild owns the most it may');
  return Number(shop.guildMarks) < w.price ? t('guild.shop.why.treasury', 'the silver treasury is short') : null;
}

/** A ware's standing, said under its name. */
export function guildWareState(/** @type {any} */ w) {
  if (w.payer === 'account') return w.held ? `${t('guild.shop.state.held', 'You own this.')} ${guildWareUseText(w.key)}` : t('guild.shop.state.account', 'Bought once, for every character on your account.');
  return t('guild.shop.state.guild', 'The guild owns {owned} of {max}. {placed} set down.', { owned: Number(w.owned) || 0, max: Number(w.max) || 0, placed: Number(w.placed) || 0 });
}

/**
 * THE PAGE'S NODES - a card for the purse, then one a section. `k` the window's kit: `el`, `btn`, `picture(svg, w, h,
 * alt)`, `act(promise, okWord)`, `arm(key)`, `armed(key)`, `word(error)`, `state` (the window's own: `shopAsked`) and
 * `redraw()`.
 * @param {any} k @param {any} g the guild book @param {any} v the guild's view
 */
export function guildShopNodes(k, g, v) {
  const { el, btn } = k;
  if (k.state.shopFor !== v.id) { k.state.shopFor = v.id; k.state.shopAsked = false; }   // AUDIT GUILD-SHOP C2: a guild's own read
  if (!k.state.shopAsked && g.readShop) {
    k.state.shopAsked = true;
    Promise.resolve(g.readShop()).then(k.redraw, k.redraw);
  }
  const out = [el('div', 'dfsocial-sec', t('guild.shop.title', 'Guild Shop'))];
  const shop = g.shopView;
  if (!shop) {
    out.push(el('div', 'dfsocial-note', g.shopError ? t('guild.shop.unread', 'The shop cannot be read now: {why}', { why: k.word(g.shopError) }) : t('guild.shop.reading', 'Reading the shop.')));
    if (g.shopError) {
      const again = el('div', 'dfsocial-acts');
      again.append(btn(t('guild.shop.again', 'Try again'), { enabled: !g.busy, why: 'a moment', run: () => { k.state.shopAsked = false; k.redraw(); } }));
      out.push(again);
    }
    return out;
  }
  if (g.shopError) out.push(el('div', 'dfsocial-err', t('guild.shop.unread', 'The shop cannot be read now: {why}', { why: k.word(g.shopError) })));   // AUDIT GUILD-SHOP C2: said over the last read too
  out.push(el('div', 'dfsocial-note', t('guild.shop.intro', 'Everything here costs silver. Your own wares come from your silver. Hall furniture comes from the silver treasury.')));
  if (shop.open) {
    const purse = el('div', 'dfguild-purse');
    for (const [label, n] of [[t('guild.shop.purse.mine', 'Your silver'), shop.marks], [t('guild.shop.purse.guild', 'Silver treasury'), shop.guildMarks]]) {
      const c = el('div', 'dfguild-stat');
      c.append(el('div', 'dfguild-statlabel', label), el('div', 'dfguild-statvalue', Number(n ?? 0).toLocaleString('en-US')));
      purse.append(c);
    }
    out.push(purse);
  } else out.push(el('div', 'dfsocial-empty', k.word('marks-closed')));
  for (const payer of GUILD_SHOP_PAYERS) {
    const wares = (shop.wares ?? []).filter((/** @type {any} */ w) => w.payer === payer);
    if (!wares.length) continue;
    out.push(el('div', 'dfsocial-sec', payer === 'guild' ? t('guild.shop.sec.guild', 'For the hall') : t('guild.shop.sec.account', 'For you')));
    for (const w of wares) out.push(wareRow(k, g, v, shop, w));
  }
  return out;
}

/** One ware's row: its picture, its name, what it is and its standing; its price, who pays, and Buy. */
function wareRow(/** @type {any} */ k, /** @type {any} */ g, /** @type {any} */ v, /** @type {any} */ shop, /** @type {any} */ w) {
  const { el, btn } = k;
  const row = el('div', 'dfguild-ware');
  row.dataset.ware = w.key;
  const name = guildWareName(w.key);
  row.append(k.picture(guildWareSvg(w.key, v.heraldry), 56, 56, name));
  const text = el('div', 'dfguild-waretext');
  if (w.payer === 'account') text.append(el('div', 'dfguild-warekind', guildShopKindName(w.kind)));   // the hall's are all its furniture
  text.append(el('div', 'dfguild-warename', name), el('div', 'dfguild-warelook', guildWareLook(w.key)), el('div', 'dfguild-warestate', guildWareState(w)));
  const side = el('div', 'dfguild-wareside');
  side.append(el('div', 'dfguild-wareprice', marksText(w.price)), el('div', 'dfguild-warepayer', guildWarePayerText(w.payer)));
  if (w.payer === 'account' && w.held) side.append(el('div', 'dfguild-wareheld', t('guild.shop.owned', 'Owned')));
  else {
    const why = guildWareWhy(shop, w, v) ?? (g.busy ? 'a moment' : null);
    const key = `ware:${w.key}`;
    side.append(k.armed(key)
      ? btn(t('guild.shop.sure', 'Sure? {price}', { price: marksText(w.price) }), { enabled: !why, why, run: () => k.act(g.buyWare(w.key), `${t('guild.shop.bought', '{name} bought.', { name })} ${guildWareUseText(w.key)}`) })
      : btn(t('guild.shop.buy', 'Buy'), { enabled: !why, why, run: () => k.arm(key) }));
  }
  row.append(text, side);
  return row;
}
