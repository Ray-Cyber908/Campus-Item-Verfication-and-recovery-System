// Creates all tables, sequences and indexes from database/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
    await pool.exec(sql);
    console.log('Database tables are ready.');
  } catch (err) {
    console.error('Could not initialise the database:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
