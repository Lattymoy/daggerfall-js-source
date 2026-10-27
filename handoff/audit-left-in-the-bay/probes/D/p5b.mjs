import { setup, imp } from './base.mjs';
await setup();
const { reliefStands } = await imp('world/tamriel/tamrielRelief.js');
console.log('reliefStands', reliefStands());
