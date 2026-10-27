import { setup, imp } from './base.mjs';
const { maps } = await setup();
const { faunaBandAt, installTamrielFauna, biomeTable } = await imp('systems/tamrielFauna.js');
const { enemyDisplayName } = await imp('characters/enemy/enemyBasics.js');
const { encounterTable } = await imp('characters/encounterTableDoor.js');
installTamrielFauna();
const band = faunaBandAt(3355, 1108);
console.log('band', band);
for (const i of band) { const t = encounterTable(i, null, Math.random); console.log(i, t?.map((m) => `${m}:${enemyDisplayName(m)}`).join(' ')); }
const geo = await imp('world/tamriel/tamrielGeography.js');
const { pictureToBay } = await imp('world/tamriel/tamrielFrame.js');
const names = ['Whiterun', 'Windhelm', 'Riften', 'Rimmen', 'Senchal', 'Stormhold', 'Gideon', 'Dawnstar', 'Winterhold'];
for (const c of geo.CITIES.filter((c) => names.includes(c.name))) { const [x, y] = pictureToBay(c.x ?? c.px ?? c.at?.[0], c.y ?? c.py ?? c.at?.[1]); console.log(c.name, Math.floor(x), Math.floor(y), maps.getClimateIndex(Math.floor(x), Math.floor(y))); }
