// @ts-check
// GUILD-LOGO (bible/11-Multiplayer/Guild-Shop.md): THE ARMS PAGE'S LOGO CARD - a guild's own picture in place of its
// device, reviewed by the game's moderators on Discord before anyone sees it (server-account/src/guildLogos.js). The
// guildmaster picks a picture (ui/guild/guildLogoPick.js), sees it, and sends it with its fee held from the silver
// treasury; a review under way can be withdrawn, its fee home; an approved logo can be taken down. Every member sees
// what stands. Drawn through the window's own kit (ui/socialPanel.js).
import { GUILD_LOGO_FEE } from '../../net/guild/guildShopLaw.js';
import { guildLogoSrc } from '../../net/guild/guildArmsBook.js';
import { marksText } from '../../net/marksLaw.js';
import { pickGuildLogo, GUILD_LOGO_ACCEPT } from './guildLogoPick.js';
import { t } from '../../systems/textManager.js';

/** The card's own words. */
export const GUILD_LOGO_TEXT = () => t('guild.logo.about', 'Your guild can show its own picture in place of the device on its shield. A moderator checks each picture on Discord first.');

/**
 * THE CARD'S NODES. `k` the window's kit (`el`, `btn`, `doc`, `act`, `arm`, `armed`, `word`, `draft`, `redraw`); `may`
 * whether the reader is the guildmaster.
 * @param {any} k @param {any} g the guild book @param {any} v the guild's view @param {boolean} may
 */
export function guildLogoNodes(k, g, v, may) {
  const { el, btn } = k;
  const d = k.draft;
  if (d.logoFor !== v.id) { d.logoFor = v.id; d.logo = null; }   // AUDIT GUILD-SHOP C5: a picture picked is one guild's
  const out = [el('div', 'dfsocial-sec', t('guild.logo.title', 'Guild logo')), el('div', 'dfsocial-note', GUILD_LOGO_TEXT())];
  const pic = (/** @type {string | null} */ src, /** @type {string} */ alt) => {
    const box = el('div', 'dfguild-logo');
    if (src) { const img = k.doc.createElement('img'); img.src = src; img.setAttribute('alt', alt); img.setAttribute('width', '96'); img.setAttribute('height', '96'); box.append(img); }
    return box;
  };
  if (v.logo) {
    out.push(pic(guildLogoSrc(v.logo), t('guild.logo.current', 'The guild\'s logo')), el('div', 'dfsocial-note', t('guild.logo.approved', 'Approved. It shows on the guild\'s shields, banners, armlets, sails and hall pieces.')));
    if (may) {
      const acts = el('div', 'dfsocial-acts');
      acts.append(k.armed('logo-clear')
        ? btn(t('guild.logo.clearSure', 'Sure? The device returns'), { warn: true, enabled: !g.busy, why: 'a moment', run: () => k.act(g.clearLogo(), t('guild.logo.cleared', 'The logo is taken down. The guild shows its device again.')) })
        : btn(t('guild.logo.clear', 'Take the logo down'), { enabled: !g.busy, why: 'a moment', run: () => k.arm('logo-clear') }));
      out.push(acts);
    }
  }
  if (v.logoReview) {
    out.push(el('div', 'dfsocial-note', t('guild.logo.review', 'A new logo is under review. Its fee of {fee} is held until a moderator decides.', { fee: marksText(GUILD_LOGO_FEE) })));
    if (may) {
      const acts = el('div', 'dfsocial-acts');
      acts.append(btn(t('guild.logo.withdraw', 'Withdraw it'), { enabled: !g.busy, why: 'a moment', run: () => k.act(g.withdrawLogo(), t('guild.logo.withdrawn', 'The logo is withdrawn. Its fee is back in the silver treasury.')) }));
      out.push(acts);
    }
    return out;
  }
  if (!may) {   // AUDIT GUILD-RANKS C3: the logo given to more ranks than the guildmaster's
    out.push(el('div', 'dfsocial-empty', JSON.stringify(v.powers?.logo ?? [0]) === '[0]' ? t('guild.logo.master', 'The guildmaster sends a logo.') : t('guild.logo.notRank', 'Your rank does not send a logo.')));
    return out;
  }
  out.push(el('div', 'dfsocial-note', t('guild.logo.rules', 'A square picture works best. It is cut to a square and made {side} pixels across.', { side: 128 })));
  const input = k.doc.createElement('input');
  input.type = 'file';
  input.accept = GUILD_LOGO_ACCEPT;
  input.className = 'dfsocial-field';
  input.setAttribute('aria-label', t('guild.logo.choose', 'Choose a picture'));
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    d.logo = { busy: true };
    k.redraw();
    pickGuildLogo(file, { doc: k.doc }).then((r) => { d.logo = r; k.redraw(); }, () => { d.logo = { ok: false, error: 'logo-unread' }; k.redraw(); });
  });
  out.push(input);
  const chosen = d.logo;
  if (chosen?.ok) out.push(pic(chosen.url, t('guild.logo.preview', 'The picture chosen')));
  else if (chosen?.error) out.push(el('div', 'dfsocial-err', k.word(chosen.error)));
  const short = Number(v.marks ?? 0) < GUILD_LOGO_FEE;
  const why = !chosen?.ok ? t('guild.logo.why.pick', 'choose a picture') : v.marks == null ? k.word('marks-closed')   // AUDIT GUILD-SHOP C7: silver closed, said so
    : short ? t('guild.logo.why.short', 'the silver treasury is short') : g.busy ? 'a moment' : null;
  const acts = el('div', 'dfsocial-acts');
  acts.append(k.armed('logo-send')
    ? btn(t('guild.logo.sendSure', 'Sure? {fee}', { fee: marksText(GUILD_LOGO_FEE) }), { enabled: !why, why, run: () => { const image = chosen.image; d.logo = null; k.act(g.submitLogo(image), t('guild.logo.sent', 'Logo sent. A moderator will check it soon.')); } })
    : btn(t('guild.logo.send', 'Send for review ({fee})', { fee: marksText(GUILD_LOGO_FEE) }), { enabled: !why, why, run: () => k.arm('logo-send') }));
  out.push(acts);
  return out;
}
