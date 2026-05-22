// scripts/seed.js
require('dotenv').config();
const readline = require('readline/promises');
const { pool } = require('../src/database');
const password = require('../src/lib/password');
const tenantsRepo = require('../src/repositories/tenantsRepo');
const usersRepo = require('../src/repositories/usersRepo');
const rolesRepo = require('../src/repositories/rolesRepo');

const TENANT_SLUG = 'fiserv';
const TENANT_NAME = 'Fiserv';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@fiserv';

const promptPassword = async () => {
  if (process.env.SEED_ADMIN_PASSWORD) return process.env.SEED_ADMIN_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Admin password (min 12 chars): ');
  rl.close();
  if (answer.length < 12) throw new Error('Password too short');
  return answer;
};

(async () => {
  try {
    let tenant = await tenantsRepo.findBySlug(pool, TENANT_SLUG);
    if (!tenant) {
      tenant = await tenantsRepo.insert(pool, { slug: TENANT_SLUG, display_name: TENANT_NAME });
      console.log(`Created tenant: ${tenant.slug} (id=${tenant.tenant_id})`);
    } else {
      console.log(`Tenant already exists: ${tenant.slug} (id=${tenant.tenant_id})`);
    }

    const existing = await usersRepo.findByEmail(pool, tenant.tenant_id, ADMIN_EMAIL);
    if (existing) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}. Skipping.`);
      process.exit(0);
    }

    const plaintext = await promptPassword();
    const password_hash = await password.hash(plaintext);
    const user = await usersRepo.insert(pool, {
      tenant_id: tenant.tenant_id,
      email: ADMIN_EMAIL,
      password_hash,
      display_name: 'Admin',
    });
    await rolesRepo.setRolesForUser(pool, user.user_id, ['imms.admin', 'mcs.admin']);
    console.log(`Created admin user: ${ADMIN_EMAIL} (id=${user.user_id}) with imms.admin + mcs.admin`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
