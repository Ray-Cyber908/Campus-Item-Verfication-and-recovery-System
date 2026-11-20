require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
(async () => {
  try {
    const pw = process.argv[2] || 'Student@123';
    const hash = await bcrypt.hash(pw, 10);
    const r = await pool.query("UPDATE users SET password_hash = $1 WHERE role = 'student' RETURNING student_id, email", [hash]);
    console.log('Password for ' + r.rows.length + ' student account(s) is now: ' + pw);
    console.table(r.rows);
  } catch (err) { console.error('Failed:', err.message); }
  finally { await pool.end(); }
})();
