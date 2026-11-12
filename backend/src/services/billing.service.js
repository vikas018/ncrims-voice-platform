import config from '../config/index.js';

/**
 * The pulse billing engine — PURE functions, provider-agnostic, unit-tested
 * in isolation. The webhook handler feeds it OUR normalized status + duration;
 * it never trusts a provider's own billing field.
 *
 * Rules:
 *   - Non-connected calls (unanswered / busy / failed / queued / ringing) = 0 min.
 *   - Connected calls bill a 60-second MINIMUM pulse (a 15s call = 1 full minute).
 *   - Beyond the first minute, overage is billed per the configured mode:
 *       "whole_minute" (default) -> round the whole call up to the next minute.
 *       "per_second"             -> first minute flat, then exact remaining
 *                                   seconds as fractional minutes (2 decimals).
 *
 * The overage mode is a BUSINESS decision parked for Phase 4; it lives behind
 * one env var so flipping it never touches this logic.
 */

const BILLABLE_STATUS = 'connected';

/**
 * @param {string} status  normalized status (connected|unanswered|busy|failed|...)
 * @param {number} durationSeconds  connected duration in seconds
 * @param {object} [opts]  { minPulseSeconds, overageMode } — defaults from config
 * @returns {number} billed minutes
 */
export function calculatePulse(status, durationSeconds, opts = {}) {
  const minPulse = opts.minPulseSeconds ?? config.billing.minPulseSeconds; // 60
  const mode = opts.overageMode ?? config.billing.overageMode; // whole_minute | per_second

  if (status !== BILLABLE_STATUS) return 0;

  const secs = Math.max(0, Math.round(durationSeconds || 0));
  if (secs === 0) return 0; // connected but zero duration -> nothing to bill

  // Everything up to the minimum pulse is exactly one minute.
  if (secs <= minPulse) return 1;

  if (mode === 'per_second') {
    // First minute flat, remaining seconds billed exactly as fractional minutes.
    const overageMinutes = (secs - minPulse) / 60;
    return round2(1 + overageMinutes);
  }

  // Default whole_minute: round the whole call up to the next 60s boundary.
  return Math.ceil(secs / 60);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default { calculatePulse };
