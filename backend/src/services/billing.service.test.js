import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// config/index.js fails fast on missing env vars. Set dummies BEFORE importing
// billing.service (which transitively loads config), then dynamic-import it so
// the pure pulse function can be unit-tested in complete isolation.
process.env.MONGO_URI ||= 'mongodb://localhost:27017/test';
process.env.JWT_SECRET ||= 'test-secret';

let calculatePulse;
before(async () => {
  ({ calculatePulse } = await import('./billing.service.js'));
});

const WM = { minPulseSeconds: 60, overageMode: 'whole_minute' };
const PS = { minPulseSeconds: 60, overageMode: 'per_second' };

test('non-connected calls are always free', () => {
  assert.equal(calculatePulse('unanswered', 0, WM), 0);
  assert.equal(calculatePulse('busy', 120, WM), 0);
  assert.equal(calculatePulse('failed', 300, WM), 0);
  assert.equal(calculatePulse('queued', 45, WM), 0);
});

test('connected with zero duration bills nothing', () => {
  assert.equal(calculatePulse('connected', 0, WM), 0);
});

test('60-second minimum pulse: short connected calls = 1 minute', () => {
  assert.equal(calculatePulse('connected', 1, WM), 1);
  assert.equal(calculatePulse('connected', 15, WM), 1); // the spec example
  assert.equal(calculatePulse('connected', 59, WM), 1);
  assert.equal(calculatePulse('connected', 60, WM), 1);
});

test('whole_minute mode: rounds the whole call up to the next minute', () => {
  assert.equal(calculatePulse('connected', 61, WM), 2);
  assert.equal(calculatePulse('connected', 90, WM), 2);
  assert.equal(calculatePulse('connected', 120, WM), 2);
  assert.equal(calculatePulse('connected', 121, WM), 3);
  assert.equal(calculatePulse('connected', 108, WM), 2); // 1:48 -> 2 min (modal example)
});

test('per_second mode: first minute flat, then exact fractional overage', () => {
  assert.equal(calculatePulse('connected', 60, PS), 1);
  assert.equal(calculatePulse('connected', 90, PS), 1.5);
  assert.equal(calculatePulse('connected', 120, PS), 2);
  assert.equal(calculatePulse('connected', 75, PS), 1.25);
});

test('rounds negative/garbage durations safely', () => {
  assert.equal(calculatePulse('connected', -5, WM), 0);
  assert.equal(calculatePulse('connected', NaN, WM), 0);
});
