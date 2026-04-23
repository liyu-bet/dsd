const { runServerChecks, runSiteChecks, shutdownMonitorPrisma } = require('./src/lib/monitor/jobs');

const SERVER_INTERVAL_MS = Number(process.env.SERVER_CHECK_INTERVAL_MS || 5 * 60 * 1000);
const SITE_INTERVAL_MS = Math.max(10 * 60 * 1000, Number(process.env.SITE_CHECK_INTERVAL_MS || 10 * 60 * 1000));
const SERVER_INITIAL_DELAY_MS = 20 * 1000;
const SITE_INITIAL_DELAY_MS = 35 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loop(label, delayMs, fn) {
  await sleep(delayMs);
  while (true) {
    try {
      const result = await fn();
      console.log(`[WORKER] ${label}:`, JSON.stringify(result));
    } catch (error) {
      console.error(`[WORKER] ${label} failed:`, error);
    }
    await sleep(label === 'server_checks' ? SERVER_INTERVAL_MS : SITE_INTERVAL_MS);
  }
}

async function main() {
  console.log('[WORKER] Monitor worker started');
  loop('server_checks', SERVER_INITIAL_DELAY_MS, () => runServerChecks({ trigger: 'worker' }));
  loop('site_checks', SITE_INITIAL_DELAY_MS, () => runSiteChecks({ trigger: 'worker' }));
}

main();

async function shutdown(signal) {
  console.log(`[WORKER] Received ${signal}, shutting down...`);
  await shutdownMonitorPrisma().catch(() => null);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
