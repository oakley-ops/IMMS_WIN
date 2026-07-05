const fs = require('fs');
const os = require('os');
const path = require('path');
const { runMigrations } = require('../../../src/database/migrate');

// A fake db whose client records every SQL string it executes.
const makeDb = ({ appliedRows = [], failOn = null } = {}) => {
  const calls = [];
  const client = {
    query: jest.fn(async (sql) => {
      calls.push(sql);
      if (failOn && typeof sql === 'string' && sql.includes(failOn)) throw new Error('boom: ' + failOn);
      if (typeof sql === 'string' && /^SELECT filename FROM imms_schema_migrations/i.test(sql)) {
        return { rows: appliedRows };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { db: { getClient: jest.fn(async () => client) }, client, calls };
};

const makeDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imms-mig-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
};

const sixFiles = () => {
  const files = {};
  for (let i = 1; i <= 6; i++) files[`00${i}_m.sql`] = `CREATE TABLE t${i} (id int);`;
  return files;
};

describe('runMigrations', () => {
  test('applies pending .sql in filename order inside transactions and records them', async () => {
    const dir = makeDir({
      '002_second.sql': 'CREATE TABLE two (id int);',
      '001_first.sql': 'CREATE TABLE one (id int);',
      'notes.txt': 'ignore me',
    });
    const { db, calls } = makeDb();
    const result = await runMigrations(db, { dir });
    expect(result.applied).toEqual(['001_first.sql', '002_second.sql']);
    const oneIdx = calls.findIndex((s) => typeof s === 'string' && s.includes('CREATE TABLE one'));
    const twoIdx = calls.findIndex((s) => typeof s === 'string' && s.includes('CREATE TABLE two'));
    expect(oneIdx).toBeGreaterThan(-1);
    expect(twoIdx).toBeGreaterThan(oneIdx);
    expect(calls.filter((s) => s === 'BEGIN')).toHaveLength(2);
    expect(calls.filter((s) => s === 'COMMIT')).toHaveLength(2);
    expect(calls.filter((s) => typeof s === 'string' && s.startsWith('INSERT INTO imms_schema_migrations'))).toHaveLength(2);
  });

  test('skips files already recorded', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);', '002_second.sql': 'CREATE TABLE two (id int);' });
    const { db, calls } = makeDb({ appliedRows: [{ filename: '001_first.sql' }] });
    const result = await runMigrations(db, { dir });
    expect(result.applied).toEqual(['002_second.sql']);
    expect(calls.some((s) => typeof s === 'string' && s.includes('CREATE TABLE one'))).toBe(false);
    expect(calls.some((s) => typeof s === 'string' && s.includes('CREATE TABLE two'))).toBe(true);
  });

  test('--baseline records pending files WITHOUT executing their SQL', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);', '002_second.sql': 'CREATE TABLE two (id int);' });
    const { db, calls } = makeDb();
    const result = await runMigrations(db, { dir, baseline: true });
    expect(result.applied).toEqual(['001_first.sql', '002_second.sql']);
    // no MIGRATION-file DDL ran (the tracking-table bootstrap CREATE TABLE is expected and excluded)
    expect(calls.filter((s) => typeof s === 'string' && /CREATE TABLE/i.test(s) && !/imms_schema_migrations/i.test(s))).toHaveLength(0);
    expect(calls.some((s) => s === 'BEGIN')).toBe(false);
    expect(calls.filter((s) => typeof s === 'string' && s.startsWith('INSERT INTO imms_schema_migrations'))).toHaveLength(2);
  });

  test('first-run guard: refuses to apply when nothing recorded and >5 pending', async () => {
    const dir = makeDir(sixFiles());
    const { db, calls } = makeDb(); // appliedRows empty -> 0 recorded
    await expect(runMigrations(db, { dir })).rejects.toThrow(/Existing database detected/);
    // no MIGRATION-file DDL ran (the tracking-table bootstrap CREATE TABLE is expected and excluded)
    expect(calls.filter((s) => typeof s === 'string' && /CREATE TABLE/i.test(s) && !/imms_schema_migrations/i.test(s))).toHaveLength(0);
  });

  test('--force bypasses the guard and applies all', async () => {
    const dir = makeDir(sixFiles());
    const { db, calls } = makeDb();
    const result = await runMigrations(db, { dir, force: true });
    expect(result.applied).toHaveLength(6);
    expect(calls.filter((s) => s === 'COMMIT')).toHaveLength(6);
  });

  test('guard does not fire once files are recorded (0 pending)', async () => {
    const files = sixFiles();
    const dir = makeDir(files);
    const appliedRows = Object.keys(files).map((filename) => ({ filename }));
    const { db } = makeDb({ appliedRows });
    const result = await runMigrations(db, { dir });
    expect(result.applied).toEqual([]);
  });

  test('a failing migration rolls back and throws a wrapped error', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);', '002_bad.sql': 'THIS IS BAD SQL;' });
    const { db, calls } = makeDb({ failOn: 'THIS IS BAD SQL' });
    await expect(runMigrations(db, { dir })).rejects.toThrow(/Migration 002_bad\.sql failed/);
    expect(calls.some((s) => s === 'ROLLBACK')).toBe(true);
  });
});
