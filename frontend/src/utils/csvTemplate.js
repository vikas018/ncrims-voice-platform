/**
 * The patient-upload template. Headers match exactly what the backend CSV
 * parser expects (Name + Phone required; the rest optional). Demo rows show
 * the accepted formats — plain 10-digit, +91, and leading-0 are all valid.
 */
export const TEMPLATE_HEADERS = ['Name', 'Phone', 'Doctor/Dept', 'Appointment', 'Purpose'];

const DEMO_ROWS = [
  ['Rohit Verma', '9811023456', 'Dr. Mehra · Endocrinology', '2026-11-18 10:30', 'Camp registration'],
  ['Sunita Devi', '+91 99100 87654', 'Dr. Mehra · Endocrinology', '2026-11-18 11:00', 'Camp registration'],
  ['Kavita Nair', '09700011223', 'Dr. Rao · General Med', '2026-11-19 09:15', 'Appointment confirmation'],
  ['Deepak Chauhan', '9810576543', 'Dr. Khanna · Cardiology', '2026-11-20 09:00', 'Follow-up'],
];

function toCsvCell(value) {
  const s = String(value ?? '');
  // Quote cells containing commas, quotes, or newlines (RFC-4180).
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Generic CSV download: headers (array) + rows (array of arrays) -> file. */
export function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((r) => r.map(toCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM = Excel-friendly
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Build the CSV text (headers + demo rows, or headers only). */
export function buildTemplateCsv({ includeDemo = true } = {}) {
  const rows = [TEMPLATE_HEADERS, ...(includeDemo ? DEMO_ROWS : [])];
  return rows.map((r) => r.map(toCsvCell).join(',')).join('\r\n');
}

// ---- Staff upload template ----
export const USER_TEMPLATE_HEADERS = ['Name', 'Email', 'Role', 'Password'];
const USER_DEMO_ROWS = [
  ['Neha Singh', 'neha.singh@ncrims.in', 'staff', 'ncrims@123'],
  ['Amit Rao', 'amit.rao@ncrims.in', 'staff', 'ncrims@123'],
  ['Dr. Anil Kumar', 'anil.kumar@ncrims.in', 'admin', 'ncrims@123'],
];

/** Download the staff-upload template (Name, Email, Role, Password). */
export function downloadUserTemplate({ includeDemo = true } = {}) {
  const rows = [USER_TEMPLATE_HEADERS, ...(includeDemo ? USER_DEMO_ROWS : [])];
  downloadCsv(includeDemo ? 'ncrims-staff-template-sample.csv' : 'ncrims-staff-template-blank.csv',
    rows[0], rows.slice(1));
}

/** Trigger a browser download of the patient template file. */
export function downloadTemplate({ includeDemo = true } = {}) {
  const csv = buildTemplateCsv({ includeDemo });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM = Excel-friendly
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = includeDemo ? 'ncrims-patient-template-sample.csv' : 'ncrims-patient-template-blank.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
