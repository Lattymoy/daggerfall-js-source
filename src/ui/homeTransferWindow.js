// A house offered at its own door. The service keeps the gold, the goods and the owner.
// ENH-NOTICE3: it builds the game's own windows, so it lives under ui/ - no system names a window.
// The questions are the game's own windows. A form on the page sits under the canvas and cannot be used.

import { ChoiceWindow } from './talkWindow.js';
import { InputMessageBoxWindow } from './inputMessageBox.js';
import { walletReserve } from '../net/realm/realmGoldLaw.js';
import { t } from '../systems/textManager.js';

const NAME_RE = /^[A-Za-z0-9]{3,16}$/;
const PRICE_MAX = 100_000_000;

/**
 * The owner's door: who receives the house, for how much, and whether its furnishings and goods go with it.
 * `giving` is an offer already out (its id). `show` is the town's overlay slot.
 * @param {number} mapId
 * @param {number} buildingKey
 * @param {{ onlineHomes?: { transfer?: Function }, realmAct?: Function }} host
 * @param {(text: string) => void} say
 * @param {(code: string) => string} refusal
 * @param {string | null} [giving]
 * @param {(win: object) => void} [show]
 */
export function openHomeTransfer(mapId, buildingKey, host, say, refusal, giving = null, show = null) {
  const tell = typeof say === 'function' ? say : () => {};
  const word = typeof refusal === 'function' ? refusal : (c) => String(c ?? '');
  const mount = typeof show === 'function' ? show : () => {};
  if (!host?.onlineHomes?.transfer) { tell(t('housing.transfer.signedOut', 'You are not signed in.')); return false; }
  if (giving) {
    mount(new ChoiceWindow({
      lines: [t('housing.transfer.offerOut', 'An offer for this house is already out.')],
      options: [
        { code: 'KeyW', label: t('housing.transfer.withdraw', 'W - withdraw the offer'), action: () => { void send(host, { op: 'cancel', id: giving, mapId, buildingKey }, tell, word); } },
        { code: 'Escape', label: t('housing.transfer.leaveIt', 'Esc - leave it'), action: () => {} },
      ],
    }));
    return true;
  }
  askName(mapId, buildingKey, host, tell, word, mount);
  return true;
}

/** The account named on the offer: accept it, or decline it. */
export function answerHomeTransfer(mapId, buildingKey, home, accept, host, say, refusal, show = null, wallet = null) {
  const offer = home?.offer;
  if (!offer?.id) return false;
  const tell = typeof say === 'function' ? say : () => {};
  const word = typeof refusal === 'function' ? refusal : (c) => String(c ?? '');
  const mount = typeof show === 'function' ? show : () => {};
  const price = Math.max(0, Math.floor(Number(offer.price) || 0));
  const kept = `${offer.keepDecor ? t('housing.transfer.furnishingsStay', 'The furnishings stay.') : t('housing.transfer.furnishingsGo', 'The furnishings do not stay.')}${offer.keepItems ? t('housing.transfer.goodsStay', ' The goods stay.') : ''}`;
  const line = accept ? (price > 0 ? t('housing.transfer.takePriced', 'Take this house for {price} gold? {kept}', { price, kept }) : t('housing.transfer.takeFree', 'Take this house? {kept}', { kept })) : t('housing.transfer.declineAsk', 'Decline this house?');
  const op = accept ? 'accept' : 'decline';
  mount(new ChoiceWindow({
    lines: [line],
    options: [
      { code: 'KeyY', label: accept ? 'Y - accept' : 'Y - decline', action: () => { void send(host, { op, id: offer.id, mapId, buildingKey }, tell, word, accept ? { price, wallet } : null); } },
      { code: 'Escape', label: t('housing.transfer.notNow', 'Esc - not now'), action: () => {} },
    ],
  }));
  return true;
}

function askName(mapId, buildingKey, host, tell, word, mount) {
  mount(new InputMessageBoxWindow({
    lines: [t('housing.transfer.title', 'Transfer this house')],
    label: t('housing.transfer.toAccount', 'To account: '),
    maxCharacters: 16,
    onSubmit: (raw) => {
      const to = String(raw ?? '').trim();
      if (!NAME_RE.test(to)) { tell(t('housing.transfer.badName', 'That is not an account name.')); askName(mapId, buildingKey, host, tell, word, mount); return; }
      askPrice(mapId, buildingKey, host, tell, word, mount, to);
    },
  }));
}

function askPrice(mapId, buildingKey, host, tell, word, mount, to) {
  mount(new InputMessageBoxWindow({
    lines: [t('housing.transfer.offerTo', 'Offer the house to {to}.', { to })],
    label: t('housing.transfer.price', 'Price in gold (0 is a gift): '),
    numeric: true,
    maxCharacters: 9,
    onSubmit: (raw) => {
      const price = Math.max(0, Math.min(PRICE_MAX, Math.floor(Number(raw) || 0)));
      askKeep(mapId, buildingKey, host, tell, word, mount, to, price);
    },
  }));
}

function askKeep(mapId, buildingKey, host, tell, word, mount, to, price) {
  mount(new ChoiceWindow({
    lines: [t('housing.transfer.leaveFurnishings', 'Leave the furnishings with the house?')],
    options: [
      { code: 'KeyY', label: t('housing.transfer.yesLeave', 'Y - leave them'), action: () => askGoods(mapId, buildingKey, host, tell, word, mount, to, price) },
      { code: 'KeyN', label: t('housing.transfer.noTake', 'N - take them back'), action: () => confirm(mapId, buildingKey, host, tell, word, mount, to, price, false, false) },
      { code: 'Escape', label: 'Esc - cancel', action: () => {} },
    ],
  }));
}

function askGoods(mapId, buildingKey, host, tell, word, mount, to, price) {
  mount(new ChoiceWindow({
    lines: [t('housing.transfer.leaveGoods', 'Leave the goods in its chests and stalls?')],
    options: [
      { code: 'KeyY', label: t('housing.transfer.yesGoods', 'Y - leave the goods'), action: () => confirm(mapId, buildingKey, host, tell, word, mount, to, price, true, true) },
      { code: 'KeyN', label: t('housing.transfer.noGoods', 'N - keep the goods'), action: () => confirm(mapId, buildingKey, host, tell, word, mount, to, price, true, false) },
      { code: 'Escape', label: 'Esc - cancel', action: () => {} },
    ],
  }));
}

function confirm(mapId, buildingKey, host, tell, word, mount, to, price, keepDecor, keepItems) {
  const kept = `${keepDecor ? 'furnishings stay' : 'furnishings return'}${keepItems ? t('housing.transfer.goodsAlso', ', goods stay') : ''}`;
  mount(new ChoiceWindow({
    lines: [t('housing.transfer.confirm', 'Offer this house to {to} for {price} gold. {kept}.', { to, price, kept })],
    options: [
      { code: 'KeyY', label: t('housing.transfer.yesOffer', 'Y - offer it'), action: () => { void send(host, { op: 'offer', mapId, buildingKey, to, price, keepDecor, keepItems }, tell, word); } },
      { code: 'Escape', label: 'Esc - cancel', action: () => {} },
    ],
  }));
}

async function send(host, body, tell, word, pay = null) {
  const homes = host.onlineHomes;
  const act = host.realmAct;
  const price = Math.max(0, Math.floor(Number(pay?.price) || 0));
  const wallet = pay?.wallet ?? null;
  if (body.op === 'accept' && price > 0 && !(wallet?.gold >= price)) { tell(word('realm-gold')); return { ok: false, error: 'realm-gold' }; }
  const held = body.op === 'accept' && price > 0 ? walletReserve(wallet, price) : null;
  let r;
  try {
    r = !act || body.op !== 'accept'
      ? await homes.transfer(body)
      : await act({
        needsAnswer: true,
        reserve: held?.reserve ?? null,
        apply: (res) => { if (res?.repeat || res?.data?.repeat) held?.back(); },
        call: (at) => homes.transfer({ ...body, realm: at }),
      });
  } catch {
    tell(t('housing.transfer.unsent', 'The offer could not be sent.'));
    return { ok: false, error: 'server' };
  }
  if (!r?.ok) tell(word(r?.error ?? 'server'));
  else if (body.op === 'offer') tell(t('housing.transfer.sent', 'The offer is out. It stands for three days.'));
  else if (body.op === 'accept') tell(t('housing.transfer.yours', 'The house is yours.'));
  else if (body.op === 'decline') tell(t('housing.transfer.declined', 'The offer is declined.'));
  else if (body.op === 'cancel') tell(t('housing.transfer.withdrawn', 'The offer is withdrawn.'));
  return r;
}
