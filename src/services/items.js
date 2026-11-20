const { pool } = require('../db');
const { runMatchingForLost, runMatchingForFound } = require('../utils/matcher');

const CATEGORY_CODES = {
  'Drawing Instrument': 'DRAW',
  'Bag / Backpack': 'BAG',
  'Water Bottle': 'WATER',
  'Electronics': 'ELEC',
  'ID Card / Documents': 'ID',
  'Books / Stationery': 'BOOK',
  'Keys': 'KEYS',
  'Wallet': 'WALLET',
  'Clothing / Accessories': 'CLOTH',
  'Other': 'OTHER',
};
const CATEGORIES = Object.keys(CATEGORY_CODES);

async function nextCode(client, prefix, category, seq) {
  const { rows } = await client.query(`SELECT nextval('${seq}') AS n`);
  const code = CATEGORY_CODES[category] || 'OTHER';
  return `${prefix}-${code}-${new Date().getFullYear()}-${String(rows[0].n).padStart(5, '0')}`;
}

async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function createLostItem(userId, d, photoPath) {
  return inTransaction(async (client) => {
    const code = await nextCode(client, 'LOST', d.category, 'lost_seq');
    const { rows } = await client.query(
      `INSERT INTO lost_items
        (report_code, user_id, category, brand, color, last_seen_location, date_lost,
         description, identifiers, identification_details, photo_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [code, userId, d.category, d.brand, d.color, d.last_seen_location, d.date_lost,
       d.description, d.identifiers || [], d.identification_details, photoPath]
    );
    await runMatchingForLost(client, rows[0]);
    return rows[0];
  });
}

function createFoundItem(userId, d, photoPath) {
  return inTransaction(async (client) => {
    const code = await nextCode(client, 'FOUND', d.category, 'found_seq');
    const { rows } = await client.query(
      `INSERT INTO found_items
        (report_code, user_id, category, brand, color, found_location, date_found,
         condition, description, hidden_details, photo_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [code, userId, d.category, d.brand, d.color, d.found_location, d.date_found,
       d.condition, d.description, d.hidden_details, photoPath]
    );
    await runMatchingForFound(client, rows[0]);
    return rows[0];
  });
}

module.exports = { CATEGORIES, createLostItem, createFoundItem, inTransaction };
