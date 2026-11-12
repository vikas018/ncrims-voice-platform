import { parse } from 'csv-parse/sync';

/**
 * Parse an uploaded patient CSV into validated rows. Returns both the valid
 * rows (ready to become call logs) and the invalid ones (shown in the preview
 * with per-row errors) — so staff see "1,497 valid, 3 errors" BEFORE committing.
 *
 * Expected headers (case-insensitive, flexible):
 *   Name, Phone, Doctor/Dept, Appointment, Purpose
 */
const HEADER_ALIASES = {
  name: ['name', 'patient', 'patient name', 'patientname'],
  phone: ['phone', 'phone number', 'phonenumber', 'mobile', 'number', 'contact'],
  doctorOrDept: ['doctor', 'department', 'doctor/dept', 'doctor/department', 'dept', 'doctorordept'],
  appointmentAt: ['appointment', 'appointment date', 'appointment date/time', 'appointmentat', 'date'],
  purpose: ['purpose', 'reason', 'notes'],
};

function resolveHeaders(rawHeaders) {
  const map = {};
  rawHeaders.forEach((h, i) => {
    const key = String(h).trim().toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key)) map[field] = i;
    }
  });
  return map;
}

/** Normalize an Indian phone number to +91XXXXXXXXXX, or return null if invalid. */
export function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, ''); // keep digits only (drops +, spaces, dashes)
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2); // +91 / 91 prefix
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1); // leading 0
  if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export function parsePatientCsv(buffer) {
  const records = parse(buffer, { skip_empty_lines: true, trim: true });
  if (records.length === 0) return { valid: [], invalid: [], totalRows: 0 };

  const headerMap = resolveHeaders(records[0]);
  if (headerMap.name === undefined || headerMap.phone === undefined) {
    throw new Error('CSV must contain at least "Name" and "Phone" columns.');
  }

  const valid = [];
  const invalid = [];

  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    const name = (row[headerMap.name] || '').trim();
    const rawPhone = headerMap.phone !== undefined ? row[headerMap.phone] : '';
    const phone = normalizePhone(rawPhone);

    const base = {
      rowNumber: r + 1,
      patientName: name,
      phoneRaw: String(rawPhone || '').trim(),
      phoneNumber: phone,
      doctorOrDept: headerMap.doctorOrDept !== undefined ? (row[headerMap.doctorOrDept] || '').trim() : '',
      appointmentAt: headerMap.appointmentAt !== undefined ? (row[headerMap.appointmentAt] || '').trim() : '',
      purpose: headerMap.purpose !== undefined ? (row[headerMap.purpose] || '').trim() : '',
    };

    const errors = [];
    if (!name) errors.push('Missing name');
    if (!phone) errors.push('Invalid phone number');

    if (errors.length) invalid.push({ ...base, errors });
    else valid.push(base);
  }

  return { valid, invalid, totalRows: records.length - 1 };
}

/**
 * Parse a staff-upload CSV into validated user rows.
 * Columns (case-insensitive): Name, Email, Role, Password.
 * Role defaults to "staff"; Password defaults to a shared temp password that
 * staff change on first login via their profile.
 */
const USER_HEADER_ALIASES = {
  name: ['name', 'full name', 'fullname', 'staff', 'staff name'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  role: ['role', 'type', 'access'],
  password: ['password', 'temp password', 'temporary password', 'pass'],
};

const DEFAULT_TEMP_PASSWORD = 'ncrims@123';

function resolveUserHeaders(rawHeaders) {
  const map = {};
  rawHeaders.forEach((h, i) => {
    const key = String(h).trim().toLowerCase();
    for (const [field, aliases] of Object.entries(USER_HEADER_ALIASES)) {
      if (aliases.includes(key)) map[field] = i;
    }
  });
  return map;
}

export function parseUserCsv(buffer) {
  const records = parse(buffer, { skip_empty_lines: true, trim: true });
  if (records.length === 0) return { valid: [], invalid: [], totalRows: 0 };

  const h = resolveUserHeaders(records[0]);
  if (h.name === undefined || h.email === undefined) {
    throw new Error('CSV must contain at least "Name" and "Email" columns.');
  }

  const valid = [];
  const invalid = [];
  const seenEmails = new Set();

  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    const name = (row[h.name] || '').trim();
    const email = (row[h.email] || '').trim().toLowerCase();
    let role = h.role !== undefined ? (row[h.role] || '').trim().toLowerCase() : 'staff';
    if (role !== 'admin' && role !== 'staff') role = 'staff';
    const password = (h.password !== undefined ? (row[h.password] || '').trim() : '') || DEFAULT_TEMP_PASSWORD;

    const errors = [];
    if (!name) errors.push('Missing name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email');
    if (email && seenEmails.has(email)) errors.push('Duplicate email in file');
    seenEmails.add(email);

    const base = { rowNumber: r + 1, name, email, role, password };
    if (errors.length) invalid.push({ ...base, errors });
    else valid.push(base);
  }

  return { valid, invalid, totalRows: records.length - 1, defaultPassword: DEFAULT_TEMP_PASSWORD };
}

export default { parsePatientCsv, parseUserCsv, normalizePhone };
