import { describe, it, expect, vi, beforeEach } from 'vitest';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runMigrations } = require('./migrate');

// A fake db whose client records every SQL string it executes.
const makeDb = ({ appliedRows = [], failOn = null } = {}) => {
  const calls = [];
  const client = {
    query: vi.fn(async (sql) => {
      calls.push(sql);
      if (failOn && sql.includes(failOn)) throw new Error('boom: ' + failOn);
      if (/^SELECT filename FROM mcs_schema_migrations/i.test(sql)) {
        return { rows: appliedRows };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { db: { getClient: vi.fn(async () => client) }, client, calls };
};

const makeDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcs-mig-'));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql);
  }
  return dir;
};

describe('runMigrations', () => {
  it('applies pending .sql files in filename order inside transactions and records them', async () => {
    const dir = makeDir({
      '002_second.sql': 'CREATE TABLE two (id int);',
      '001_first.sql': 'CREATE TABLE one (id int);',
      'notes.txt': 'ignore me',
    });
    const { db, calls } = makeDb();

    const result = await runMigrations(db, { dir });

    expect(result.applied).toEqual(['001_first.sql', '002_second.sql']);
    const oneIdx = calls.findIndex((s) => s.includes('CREATE TABLE one'));
    const twoIdx = calls.findIndex((s) => s.includes('CREATE TABLE two'));
    expect(oneIdx).toBeGreaterThan(-1);
    expect(twoIdx).toBeGreaterThan(oneIdx);
    // each file: BEGIN before, COMMIT after, INSERT tracking row
    expect(calls.filter((s) => s === 'BEGIN')).toHaveLength(2);
    expect(calls.filter((s) => s === 'COMMIT')).toHaveLength(2);
    expect(calls.filter((s) => s.startsWith('INSERT INTO mcs_schema_migrations'))).toHaveLength(2);
  });

  it('skips files already recorded in mcs_schema_migrations', async () => {
    const dir = makeDir({
      '001_first.sql': 'CREATE TABLE one (id int);',
      '002_second.sql': 'CREATE TABLE two (id int);',
    });
    const { db, calls } = makeDb({ appliedRows: [{ filename: '001_first.sql' }] });

    const result = await runMigrations(db, { dir });

    expect(result.applied).toEqual(['002_second.sql']);
    expect(result.skipped).toBe(1);
    expect(calls.some((s) => s.includes('CREATE TABLE one'))).toBe(false);
  });

  it('rolls back and rethrows with the filename when a migration fails', async () => {
    const dir = makeDir({ '001_bad.sql': 'CREATE TABLE broken (id int);' });
    const { db, calls, client } = makeDb({ failOn: 'CREATE TABLE broken' });

    await expect(runMigrations(db, { dir })).rejects.toThrow(/001_bad\.sql/);
    expect(calls).toContain('ROLLBACK');
    expect(calls.some((s) => s.startsWith('INSERT INTO mcs_schema_migrations'))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('--baseline records pending files without executing their SQL', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);' });
    const { db, calls } = makeDb();

    const result = await runMigrations(db, { dir, baseline: true });

    expect(result.applied).toEqual(['001_first.sql']);
    expect(calls.some((s) => s.includes('CREATE TABLE one'))).toBe(false);
    expect(calls.filter((s) => s.startsWith('INSERT INTO mcs_schema_migrations'))).toHaveLength(1);
  });
});
