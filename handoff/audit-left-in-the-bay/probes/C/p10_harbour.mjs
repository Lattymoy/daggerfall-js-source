// C probe 10: the harbourmaster at a port past the Bay (worldPorts.js beyondPorts: crown null) - scenes/harbourOffice.js
// with the captain's ledger, the port the naval host names there, and the board's port list.
import { imp } from './setup.mjs';
const { createHarbourOffice } = await imp('scenes/harbourOffice.js');
const { createCaptainLedger } = await imp('systems/naval/captainLedger.js');
const ledger = createCaptainLedger();
const sea = () => true;
const bayPort = { key: '214,330', name: 'Daggerfall', px: 214, py: 330, region: 17, crown: 'Daggerfall' };
const solitude = { key: '1569,-430', name: 'Solitude', px: 1569, py: -430, region: 64, area: 0, theatre: 3, crown: null };
const ports = [bayPort, solitude, { key: '300,320', name: 'Bay Two', px: 300, py: 320, region: 17, crown: 'Daggerfall' }, { key: '1700,-420', name: 'Dawnstar', px: 1700, py: -420, region: 64, crown: null }];
for (const port of [bayPort, solitude]) {
  const o = createHarbourOffice({ ledger, now: () => 0, day: () => 10, level: () => 10, gold: () => 100000, port: () => port, ports: () => ports, seaAt: sea });
  const m = o.model({ uid: 1 });
  console.log(`${port.name}: model ${m ? `{ board: ${m.board.length} offers, marque: ${m.marque.can}, admiralty open: ${m.admiralty.open} }` : 'null (no Harbormaster tab)'}; board(): ${o.board().length}`);
}
