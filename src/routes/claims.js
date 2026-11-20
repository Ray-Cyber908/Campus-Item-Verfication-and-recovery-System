const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, clean } = require('../utils/helpers');
const { inTransaction } = require('../services/items');

const router = express.Router();
router.use(requireAuth);

const LIST_SQL = `
  SELECT c.id, c.claim_code, c.status, c.created_at, c.updated_at,
         l.report_code AS lost_code, f.report_code AS found_code, l.category AS item,
         u.name AS student_name, u.student_id AS student_id
  FROM claims c
  JOIN lost_items  l ON l.id = c.lost_item_id
  JOIN found_items f ON f.id = c.found_item_id
  JOIN users u ON u.id = c.student_user_id`;

// GET /api/claims/mine   (student: claims raised for my lost items)
router.get('/mine', wrap(async (req, res) => {
  const { rows } = await db.query(`${LIST_SQL} WHERE c.student_user_id = $1 ORDER BY c.created_at DESC`, [req.user.id]);
  res.json({ claims: rows });
}));

// GET /api/claims   (admin)
router.get('/', requireRole('admin'), wrap(async (req, res) => {
  const { rows } = await db.query(`${LIST_SQL} ORDER BY (c.status = 'pending') DESC, c.created_at DESC`);
  res.json({ claims: rows });
}));

// GET /api/claims/:id
router.get('/:id', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*, row_to_json(l) AS lost, row_to_json(f) AS found,
            u.name AS student_name, u.student_id AS student_id
     FROM claims c
     JOIN lost_items  l ON l.id = c.lost_item_id
     JOIN found_items f ON f.id = c.found_item_id
     JOIN users u ON u.id = c.student_user_id
     WHERE c.id = $1`,
    [req.params.id]
  );
  const claim = rows[0];
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });

  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && claim.student_user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only view your own claims.' });
  }
  if (!isAdmin) {
    // Students never see the found item's details or hidden notes - only its code
    claim.found = { report_code: claim.found.report_code, status: claim.found.status };
  }
  res.json({ claim });
}));

// PUT /api/claims/:id/response   (student answers the verification question)
router.put('/:id/response', wrap(async (req, res) => {
  const text = clean(req.body.response);
  if (!text) return res.status(400).json({ error: 'Describe the item so the admin can verify it.' });
  const { rows } = await db.query(
    `UPDATE claims SET student_response = $1, updated_at = NOW()
     WHERE id = $2 AND student_user_id = $3 AND status = 'pending' RETURNING id`,
    [text, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No pending claim found.' });
  res.json({ ok: true });
}));

// PUT /api/claims/:id/verify   (admin)  { status: 'approved' | 'rejected', note }
router.put('/:id/verify', requireRole('admin'), wrap(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected.' });
  }
  const note = clean(req.body.note);

  const result = await inTransaction(async (client) => {
    const c = await client.query('SELECT * FROM claims WHERE id = $1 FOR UPDATE', [req.params.id]);
    const claim = c.rows[0];
    if (!claim) { const e = new Error('Claim not found.'); e.status = 404; throw e; }
    if (claim.status !== 'pending') {
      const e = new Error('This claim has already been decided.'); e.status = 409; throw e;
    }
    await client.query(
      `UPDATE claims SET status = $1, verification_note = $2, verified_by = $3, updated_at = NOW() WHERE id = $4`,
      [status, note, req.user.id, claim.id]
    );
    if (status === 'approved') {
      await client.query("UPDATE lost_items  SET status = 'returned' WHERE id = $1", [claim.lost_item_id]);
      await client.query("UPDATE found_items SET status = 'returned' WHERE id = $1", [claim.found_item_id]);
      await client.query("UPDATE matches SET status = 'approved' WHERE id = $1", [claim.match_id]);
    } else {
      await client.query("UPDATE lost_items  SET status = 'open' WHERE id = $1", [claim.lost_item_id]);
      await client.query("UPDATE found_items SET status = 'open' WHERE id = $1", [claim.found_item_id]);
      await client.query("UPDATE matches SET status = 'rejected' WHERE id = $1", [claim.match_id]);
    }
    const out = await client.query(
      `SELECT c.*, l.report_code AS lost_code, f.report_code AS found_code
       FROM claims c JOIN lost_items l ON l.id = c.lost_item_id JOIN found_items f ON f.id = c.found_item_id
       WHERE c.id = $1`, [claim.id]);
    return out.rows[0];
  });
  res.json({ claim: result });
}));

module.exports = router;
