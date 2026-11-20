// npm run db:seed        -> creates the admin account
// npm run db:seed:demo   -> admin + sample students and the example items from the project flow
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { createLostItem, createFoundItem } = require('../src/services/items');

async function upsertUser(student_id, name, email, password, role) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (student_id, name, email, password_hash, role)
     VALUES ($1,$2,lower($3),$4,$5)
     ON CONFLICT (student_id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
     RETURNING *`,
    [student_id, name, email, hash, role]
  );
  return rows[0];
}

(async () => {
  try {
    const admin = await upsertUser(
      process.env.ADMIN_STUDENT_ID || 'ADMIN001',
      process.env.ADMIN_NAME || 'Campus Admin',
      process.env.ADMIN_EMAIL || 'admin@campus.edu',
      process.env.ADMIN_PASSWORD || 'Admin@123',
      'admin'
    );
    console.log(`Admin ready  ->  ${admin.email}  /  ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);

    if (process.argv.includes('--demo')) {
      const nadeem = await upsertUser('ST2025/0048', 'Nadeem Aabid', 'nadeem@campus.edu', 'Student@123', 'student');
      const riya = await upsertUser('ST2025/0102', 'Riya Sharma', 'riya@campus.edu', 'Student@123', 'student');

      const lostExists = await pool.query('SELECT 1 FROM lost_items WHERE user_id = $1', [nadeem.id]);
      if (!lostExists.rows.length) {
        await createLostItem(nadeem.id, {
          category: 'Drawing Instrument', brand: 'Camlin', color: 'Black',
          last_seen_location: 'Drawing Lab', date_lost: '2025-09-09',
          description: 'Black drawing instrument box, slightly old.',
          identifiers: ['Scratch / Crack', 'Missing Component'],
          identification_details: 'Right side corner is slightly broken. Inside the scale backside there are initials "NA".',
        }, null);
        await createLostItem(nadeem.id, {
          category: 'Water Bottle', brand: 'Milton', color: 'Blue',
          last_seen_location: 'Library', date_lost: '2025-09-05',
          description: 'Blue steel water bottle with a dent near the bottom.',
          identifiers: ['Scratch / Crack'], identification_details: 'Dent near the base.',
        }, null);
        await createFoundItem(riya.id, {
          category: 'Drawing Instrument', brand: 'Camlin', color: 'Black',
          found_location: 'Drawing Lab', date_found: '2025-09-10', condition: 'Right corner damaged',
          description: 'Black Camlin drawing box, slightly old. Right corner is broken.',
          hidden_details: 'Initials "NA" written behind the scale (hidden).',
        }, null);
        await createFoundItem(riya.id, {
          category: 'Water Bottle', brand: 'Milton', color: 'Blue',
          found_location: 'Canteen', date_found: '2025-09-12', condition: 'Dented',
          description: 'Blue Milton bottle found near the canteen.', hidden_details: null,
        }, null);
        console.log('Demo data added: students (password Student@123), lost + found reports and matches.');
      } else {
        console.log('Demo data already present - skipped.');
      }
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
