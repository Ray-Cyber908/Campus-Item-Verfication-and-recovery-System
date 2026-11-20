/**
 * Database layer with two modes (set DB_MODE in .env):
 *
 *   DB_MODE=pglite    Embedded PostgreSQL (PGlite). No install, no password.
 *                     Data is stored in backend/data/pgdata. Tables are created automatically.
 *   DB_MODE=postgres  Normal PostgreSQL server (uses DATABASE_URL or PG* variables).
 *
 * Both expose the same small interface used by the app:
 *   pool.query(sql, params), pool.connect() -> { query, release }, pool.exec(sql), pool.end()
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const MODE = (process.env.DB_MODE || 'postgres').toLowerCase();
const SCHEMA_FILE = path.join(__dirname, '..', '..', 'database', 'schema.sql');

function makePostgres() {
  const { Pool, types } = require('pg');
  types.setTypeParser(1082, (v) => v); // DATE columns as 'YYYY-MM-DD' strings
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool(); // PGHOST / PGUSER / PGPASSWORD / PGDATABASE / PGPORT
  pool.on('error', (err) => console.error('Unexpected PostgreSQL error', err));
  pool.exec = (sql) => pool.query(sql); // multi-statement scripts
  return pool;
}

function makePglite() {
  let dbPromise = null;

  function getDb() {
    if (!dbPromise) {
      dbPromise = (async () => {
        const { PGlite } = await import('@electric-sql/pglite'); // ESM package, loaded dynamically
        const dir = path.join(__dirname, '..', 'data', 'pgdata');
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        const db = new PGlite(dir, { parsers: { 1082: (v) => v } }); // DATE as plain string
        await db.waitReady;
        await db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8')); // idempotent (IF NOT EXISTS)
        return db;
      })();
    }
    return dbPromise;
  }

  // PGlite has a single connection, so run one "session" at a time (keeps transactions isolated)
  let tail = Promise.resolve();
  function lock() {
    let release;
    const prev = tail;
    tail = new Promise((r) => (release = r));
    return prev.then(() => release);
  }

  async function run(db, text, params) {
    const r = await db.query(text, params || []);
    return { rows: r.rows, rowCount: r.affectedRows !== undefined ? r.affectedRows : r.rows.length };
  }

  return {
    async query(text, params) {
      const release = await lock();
      try { return await run(await getDb(), text, params); } finally { release(); }
    },
    async connect() {
      const release = await lock();
      let db;
      try { db = await getDb(); } catch (e) { release(); throw e; }
      let released = false;
      return {
        query: (text, params) => run(db, text, params),
        release: () => { if (!released) { released = true; release(); } },
      };
    },
    async exec(sql) {
      const release = await lock();
      try { return await (await getDb()).exec(sql); } finally { release(); }
    },
    async end() {
      if (!dbPromise) return;
      const release = await lock();
      try { await (await dbPromise).close(); dbPromise = null; } finally { release(); }
    },
    on() {},
  };
}

const pool = MODE === 'pglite' ? makePglite() : makePostgres();

module.exports = { pool, mode: MODE, query: (text, params) => pool.query(text, params) };
