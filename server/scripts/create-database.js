/**
 * Creates the SQL Server login and database this app needs.
 *
 * Run once, after installing SQL Server Express:
 *   node scripts/create-database.js
 *
 * The tricky part is the chicken-and-egg: the app login does not exist yet, so
 * this script cannot connect with DATABASE_URL. It connects as an admin to
 * master instead, using SQL_ADMIN_URL (see .env.example). If SQL_ADMIN_URL is
 * missing it falls back to DATABASE_URL, which works if your DATABASE_URL
 * already points at an account with the needed rights.
 *
 * Safe to re-run: every statement is guarded, so an existing login or database
 * is left alone rather than erroring.
 */
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { URL } = require('url');

const targetUrl = process.env.DATABASE_URL;
const adminUrl = process.env.SQL_ADMIN_URL;

if (!targetUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const target = new URL(targetUrl);
const databaseName = target.searchParams.get('database') || 'chatapp';
const loginName = target.username;

const admin = new PrismaClient({ datasources: { db: { url: adminUrl || targetUrl } } });

/** Quote an identifier for SQL Server, rejecting anything odd. */
const quoteIdent = (name) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to use unsafe identifier: ${name}`);
  }
  return `[${name}]`;
};

const escapeLiteral = (value) => value.replace(/'/g, "''");

const run = async (label, sql) => {
  try {
    await admin.$executeRawUnsafe(sql);
    console.log(`  ok   ${label}`);
    return true;
  } catch (err) {
    // 15025 = server principal already exists, 1801 = database already exists,
    // 15025/1801 are the "already there" cases we treat as success.
    const benign = /already exists|15025|1801/i.test(err.message);
    console.log(`  ${benign ? 'skip' : 'FAIL'} ${label}${benign ? ' (already exists)' : ''}`);
    if (!benign) console.log(`       ${err.message}`);
    return benign;
  }
};

const main = async () => {
  if (!adminUrl) {
    console.log(
      'SQL_ADMIN_URL is not set - falling back to DATABASE_URL.\n' +
        'If the login does not exist yet, set SQL_ADMIN_URL to an admin connection string.\n'
    );
  }

  console.log(`\nSetting up "${databaseName}" with login "${loginName}"\n`);

  const password = decodeURIComponent(target.password || '');
  if (password.length < 8) {
    console.error('The password in DATABASE_URL is too short (minimum 8 characters).');
    process.exit(1);
  }

  const created = await Promise.all([
    run(
      `create login ${loginName}`,
      `CREATE LOGIN ${quoteIdent(loginName)} WITH PASSWORD = '${escapeLiteral(password)}', CHECK_POLICY = OFF`
    ),
    run(
      `create database ${databaseName}`,
      `CREATE DATABASE ${quoteIdent(databaseName)}`
    ),
  ]);

  await run(
    `grant db_owner on ${databaseName} to ${loginName}`,
    `EXEC sp_addrolemember 'db_owner', '${escapeLiteral(loginName)}'`
  );

  if (created.some((ok) => !ok)) {
    console.error('\nSome statements failed. Check the output above.');
    process.exit(1);
  }

  console.log(
    '\nDone. Now create the tables (this also creates Prisma\'s _prisma_migrations table):\n' +
      '  npx prisma migrate dev --name init\n'
  );
};

main()
  .catch((err) => {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  })
  .finally(() => admin.$disconnect());
