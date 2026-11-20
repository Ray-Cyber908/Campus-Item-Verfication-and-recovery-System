const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { inTransaction } = require('../services/items');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/matches?status=open   (open = both items still unclaimed)
router.get('/', wrap(async (req, res) => {
  const where = [];
  if (req.query.status === 'open') {
    where.push("m.status = 'open'", "l.status = 'open'", "f.status = 'open'");
  } else if (req.query.status) {
    where.push('m.status = $1');
  }
  const params = req.query.status && req.query.status !== 'open' ? [req.query.status] : [];
  const { rows } = await db.query(
    `SELECT m.id, m.match_code, m.score, m.status, m.created_at,
            l.report_code AS lost_code, f.report_code AS found_code, l.category
     FROM matches m
     JOIN lost_items  l ON l.id = m.lost_item_id
     JOIN found_items f ON f.id = m.found_item_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY m.score DESC, m.created_at DESC`,
    params
  );
  res.json({ matches: rows });
}));

// GET /api/matches/:id  full details of both items (admin only: includes hidden info)
router.get('/:id', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, row_to_json(l) AS lost, row_to_json(f) AS found,
            lu.name AS lost_reporter, fu.name AS found_reporter,
            (SELECT claim_code FROM claims c WHERE c.match_id = m.id ORDER BY c.id DESC LIMIT 1) AS claim_code
     FROM matches m
     JOIN lost_items  l  ON l.id  = m.lost_item_id
     JOIN found_items f  ON f.id  = m.found_item_id
     JOIN users lu ON lu.id = l.user_id
     JOIN users fu ON fu.id = f.user_id
     WHERE m.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Match not found.' });
  res.json({ match: rows[0] });
}));

// POST /api/matches/:id/claim  admin creates a claim request for the lost item's owner
router.post('/:id/claim', wrap(async (req, res) => {
  const claim = await inTransaction(async (client) => {
    const m = await client.query(
      `SELECT m.*, l.user_id AS owner_id, l.status AS lost_status, f.status AS found_status
       FROM matches m
       JOIN lost_items l ON l.id = m.lost_item_id
       JOIN found_items f ON f.id = m.found_item_id
       WHERE m.id = $1 FOR UPDATE OF m`,
      [req.params.id]
    );
    const match = m.rows[0];
    if (!match) { const e = new Error('Match not found.'); e.status = 404; throw e; }
    if (match.status !== 'open' || match.lost_status !== 'open' || match.found_status !== 'open') {
      const e = new Error('This match already has an active claim or one of the items is no longer available.');
      e.status = 409; throw e;
    }
    const c = await client.query(
      `INSERT INTO claims (match_id, lost_item_id, found_item_id, student_user_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [match.id, match.lost_item_id, match.found_item_id, match.owner_id]
    );
    await client.query("UPDATE matches SET status = 'claimed' WHERE id = $1", [match.id]);
    await client.query("UPDATE lost_items  SET status = 'claim_pending' WHERE id = $1", [match.lost_item_id]);
    await client.query("UPDATE found_items SET status = 'claim_pending' WHERE id = $1", [match.found_item_id]);
    return c.rows[0];
  });
  res.status(201).json({ claim });
}));

module.exports = router;
