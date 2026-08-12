/**
 * Jest setup — runs before all tests.
 * Loads .env, ensures DB connection works.
 */
import dotenv from 'dotenv';
// Set test env BEFORE app is imported
process.env.NODE_ENV = 'test';
dotenv.config();

// Increase timeout for DB operations
jest.setTimeout(30000);

// Suppress console.log during tests (keep errors)
if (process.env.NODE_ENV === 'test') {
  // Keep console.error, mute console.log
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    if (process.env.VERBOSE_TESTS === '1') origLog(...args);
  };
}
