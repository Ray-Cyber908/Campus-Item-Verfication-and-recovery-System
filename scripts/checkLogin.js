require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, mode } = require('../src/db');
(async () => {
  try {
    console.log('DB_MODE:', mode);
    const { rows } = await pool.query('SELECT id, student_id, email, role, password_hash FROM users ORDER BY id');
    console.log('Accounts found:', rows.length);
    for (const u of rows) {
      const tests = { 'Admin@123': false, 'Student@123': false };
      for (const pw of Object.keys(tests)) tests[pw] = await bcrypt.compare(pw, u.password_hash);
      console.log(JSON.stringify({ student_id: u.student_id, email: u.email, role: u.role,
        works_with_Admin_at_123: tests['Admin@123'], works_with_Student_at_123: tests['Student@123'] }));
    }
    const typed = (process.argv[2] || '').trim();
    if (typed) {
      const r = await pool.query('SELECT student_id, email FROM users WHERE lower(email) = lower($1) OR lower(student_id) = lower($1)', [typed]);
      console.log('Lookup for "' + typed + '":', r.rows.length ? 'FOUND ' + JSON.stringify(r.rows[0]) : 'NOT FOUND');
    }
  } catch (e) { console.error('PROBLEM:', e.message); }
  finally { await pool.end(); }
})();
