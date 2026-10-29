// @ts-check
// PVP-30 (the PvP rework, 2026-10-29 - the owner: "add a are you sure to the 29 to 30 levleing", "and explain this make
// u able to die in pvp zones", the words "perfect"): online, the level up from 29 to 30 asks first, because from 30 other
// players can kill you in the open PvP zones whatever your flag (net/wild/wildRef.js wildBlow, 'young'). Not yet keeps the
// level owed. A departure: DFU has no PvP.
import { t } from '../../systems/textManager.js';
import { PVP_FLAG } from '../../systems/wild/pvpFlag.js';
import { YesNoBoxWindow } from '../yesNoBox.js';
import { openLevelUpWindow } from './levelUpOpener.js';

const said = new WeakSet();

/** Does `e`'s owed level want the ask first? Online, a real level (never the Oghma's), from 29 to 30, not yet answered Yes. */
export const pvp30Asks = (e) => e?._online === true && e.readyToLevelUp === true && !e.oghmaLevelUp && e.level === PVP_FLAG.level - 1 && !said.has(e);

/** `e` answered Yes: its next door opens the level up. */
export const pvp30Said = (e) => { if (e) said.add(e); };

/** The ask's rows and its No button's word. */
export const pvp30Rows = () => [
  t('pvp.level30.warn', 'At level {n}, other players can attack and kill you in the PvP zones (Wrothgar and Cyrodiil), even when your PvP flag is off.', { n: PVP_FLAG.level }),
  '',
  t('pvp.level30.ask', 'Continue to level {n}?', { n: PVP_FLAG.level }),
];
export const pvp30No = () => t('pvp.level30.no', 'Not yet');

/** The sheet door's box for `e`: Yes opens the level up, Not yet leaves it owed. */
export const pvp30Box = (e, open = openLevelUpWindow) => new YesNoBoxWindow({ rows: pvp30Rows(), noLabel: pvp30No(), onYes: () => { pvp30Said(e); open({ defer: true }); } });
