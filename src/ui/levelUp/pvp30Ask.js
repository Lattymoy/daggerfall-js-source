// @ts-check
// PVP-30 (the PvP rework, 2026-10-29 - ): online, the level up from 29 to 30 asks first, because from 30 other
// players can kill you in the open PvP zones whatever your flag (net/wild/wildRef.js wildBlow, 'young'). Not yet keeps the
// level owed. A departure: DFU has no PvP.
import { t } from '../../systems/textManager.js';
import { PVP_FLAG } from '../../systems/wild/pvpFlag.js';
import { ETHER_WORD } from '../../world/ethericSea.js';
import { YesNoBoxWindow } from '../yesNoBox.js';
import { openLevelUpWindow } from './levelUpOpener.js';

const said = new WeakSet();

/** Does `e`'s owed level want the ask first? Online, a real level (never the Oghma's), from 29 to 30, not yet answered Yes. */
export const pvp30Asks = (e) =>
  e?._online === true && e.readyToLevelUp === true && !e.oghmaLevelUp && e.level === PVP_FLAG.level - 1 && !said.has(e);

/** `e` answered Yes: its next door opens the level up. */
export const pvp30Said = (e) => {
  if (e) said.add(e);
};

/** The ask's rows and its No button's word. */
export const pvp30Rows = () => [
  t(
    'pvp.level30.warn',
    'At level {n}, other players can attack and kill you in the PvP zones (Cyrodiil, the open {word} Ocean), even with your PvP flag off.',
    { n: PVP_FLAG.level, word: ETHER_WORD },
  ), // AUDIT TAMRIEL-WIDE III T8: the open ocean past Veilhaven, not every sea
  '',
  t('pvp.level30.ask', 'Continue to level {n}?', { n: PVP_FLAG.level }),
];
export const pvp30No = () => t('pvp.level30.no', 'Not yet');
/** PVP-HUD (the mockup): the sheet's line while the level is owed, and the button that asks. */
export const pvp30Owed = (/** @type {number} */ n) => t('pvp.level30.owed', 'Level {n} · 1 level owed', { n });
export const pvp30Go = () => t('pvp.level30.go', 'Go to {n}', { n: PVP_FLAG.level });

/** The sheet door's box for `e`: Yes opens the level up, Not yet leaves it owed. */
export const pvp30Box = (e, open = openLevelUpWindow) =>
  new YesNoBoxWindow({
    rows: pvp30Rows(),
    noLabel: pvp30No(),
    onYes: () => {
      pvp30Said(e);
      open({ defer: true });
    },
  });
