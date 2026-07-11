require('dotenv').config();
const { scanOnce } = require('./scanner');

const INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS || '300000', 10);

async function main() {
  const singleRun = process.env.RUN_MODE === 'once';

  if (singleRun) {
    // Mode utilisé par GitHub Actions : une seule exécution, puis on quitte.
    console.log('🚀 Scan unique (mode GitHub Actions).');
    await scanOnce();
    process.exit(0);
  } else {
    // Mode utilisé en local : boucle infinie toutes les X minutes.
    console.log(`🚀 Bot lancé. Scan toutes les ${INTERVAL_MS / 60000} minute(s).`);
    await scanOnce();
    setInterval(scanOnce, INTERVAL_MS);
  }
}

main();
