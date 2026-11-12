/**
 * Seed the database with the NCRIMS organization, an admin + staff user,
 * a 10,000-minute wallet top-up, and one sample campaign with queued calls.
 *
 * Run:  npm run seed
 */
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import logger from '../utils/logger.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import CallLog from '../models/CallLog.js';
import { topUp } from '../services/wallet.service.js';

const SAMPLE_PATIENTS = [
  { patientName: 'Rohit Verma', phoneNumber: '+919811023456', doctorOrDept: 'Dr. Mehra · Endocrinology', purpose: 'Camp registration' },
  { patientName: 'Sunita Devi', phoneNumber: '+919910087654', doctorOrDept: 'Dr. Mehra · Endocrinology', purpose: 'Camp registration' },
  { patientName: 'Kavita Nair', phoneNumber: '+919700011223', doctorOrDept: 'Dr. Rao · General Med', purpose: 'Camp registration' },
  { patientName: 'Mohammed Irfan', phoneNumber: '+919873044556', doctorOrDept: 'Dr. Rao · General Med', purpose: 'Appointment confirmation' },
  { patientName: 'Anjali Mehta', phoneNumber: '+919999932100', doctorOrDept: 'Dr. Mehra · Endocrinology', purpose: 'Camp registration' },
];

async function run() {
  await connectDB();
  logger.info('Seeding NCRIMS data…');

  await Promise.all([
    Organization.deleteMany({}),
    User.deleteMany({}),
    Campaign.deleteMany({}),
    CallLog.deleteMany({}),
  ]);

  const org = await Organization.create({
    name: 'NCR Institute of Medical Science',
    slug: 'ncrims',
    branding: { displayName: 'NCRIMS Care Connect', primaryColor: '#0E7C86' },
    voiceConfig: { provider: '', assistantId: '' },
  });

  const admin = new User({ organizationId: org._id, name: 'Priya Sharma', email: 'priya.sharma@ncrims.in', role: 'admin' });
  await admin.setPassword('password123');
  await admin.save();

  const staff = new User({ organizationId: org._id, name: 'Rahul Kapoor', email: 'rahul.k@ncrims.in', role: 'staff' });
  await staff.setPassword('password123');
  await staff.save();

  await topUp(org._id, 10000, 'Initial 10,000-min prepaid package');

  const campaign = await Campaign.create({
    organizationId: org._id,
    name: 'Diabetes Camp — Nov 2026',
    type: 'camp_announcement',
    language: 'hinglish',
    createdBy: admin._id,
    status: 'draft',
    stats: { total: SAMPLE_PATIENTS.length },
  });

  await CallLog.insertMany(
    SAMPLE_PATIENTS.map((p) => ({ ...p, organizationId: org._id, campaignId: campaign._id, status: 'queued' }))
  );

  logger.info('----------------------------------------------------');
  logger.info('Seed complete.');
  logger.info(`  Org:        ${org.name} (${org._id})`);
  logger.info('  Admin:      priya.sharma@ncrims.in / password123');
  logger.info('  Staff:      rahul.k@ncrims.in / password123');
  logger.info(`  Wallet:     10,000 minutes`);
  logger.info(`  Campaign:   "${campaign.name}" with ${SAMPLE_PATIENTS.length} queued calls`);
  logger.info('----------------------------------------------------');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error(e.stack || e.message);
  process.exit(1);
});
