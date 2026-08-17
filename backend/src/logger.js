/**
 * Structured logging via pino, used by the request logger (pino-http) and
 * everywhere console.log/console.error used to be. A real pino instance is
 * used in every environment (including tests) so consumers like pino-http
 * always get the interface they expect — logs are just silenced in tests
 * via `level: 'silent'` rather than swapped for a fake object.
 */
const pino = require('pino');

const isDev = !['production', 'test'].includes(process.env.NODE_ENV);

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  // pino-pretty is a devDependency — only wired up outside production so a
  // production deploy never depends on a dev-only package being present.
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});

module.exports = logger;
