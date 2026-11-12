/** Formatting helpers shared across screens. */

export const fmtInt = (n) => Number(n || 0).toLocaleString('en-IN');

/** seconds -> "m:ss" (or "—" when there's no connected duration). */
export function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const initials = (name = '') =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

// Human labels for enum values.
export const STATUS_LABEL = {
  queued: 'Queued', ringing: 'Ringing', connected: 'Connected',
  unanswered: 'Unanswered', busy: 'Busy', failed: 'Failed',
};
export const OUTCOME_LABEL = {
  confirmed: 'Confirmed', rescheduled: 'Rescheduled',
  not_interested: 'Not interested', no_outcome: '—',
};
export const CAMPAIGN_TYPE_LABEL = {
  confirmation: 'Confirm', camp_announcement: 'Camp', followup: 'Follow-up',
};

export const ENGINE_LABEL = { announcement: 'Announcement', conversation: 'Conversation' };
// Sensible default engine per campaign type (user can override).
export const DEFAULT_ENGINE = {
  confirmation: 'announcement', camp_announcement: 'announcement', followup: 'conversation',
};

export function statusTone(status) {
  if (status === 'connected') return 'b-good';
  if (status === 'unanswered') return 'b-warn';
  if (status === 'busy' || status === 'failed') return 'b-bad';
  return 'b-mut';
}
export function outcomeTone(outcome) {
  if (outcome === 'confirmed') return 'b-good';
  if (outcome === 'rescheduled') return 'b-warn';
  if (outcome === 'not_interested') return 'b-bad';
  return 'b-mut';
}
