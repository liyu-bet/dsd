/**
 * Мост для worker.js: подгружает jobsCore.ts через jiti (исходники на диске).
 * Next.js импортирует @/lib/monitor/jobsCore напрямую — jiti тут не выполняется при next build.
 */
const path = require('path');
const jiti = require('jiti')(__filename, {
  interopDefault: true,
  tsconfig: path.join(__dirname, '../../..', 'tsconfig.json'),
});

module.exports = jiti(path.join(__dirname, 'jobsCore.ts'));
