const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

// GET /api/items/mine   lost + found reports of the logged-in user
router.get('/items/mine', wrap(async (req, res) => {
  const lost = await db.query('SELECT * FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  const found = await db.query('SELECT * FROM found_items WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ lost: lost.rows, found: found.rows });
}));

// GET /api/stats   numbers for the dashboard + sidebar badges
router.get('/stats', wrap(async (req, res) => {
  if (req.user.role === 'admin') {
    const { rows } = await db.query(`
      SELECT
        (SELECT count(*) FROM matches m JOIN lost_items l ON l.id=m.lost_item_id JOIN found_items f ON f.id=m.found_item_id
          WHERE m.status='open' AND l.status='open' AND f.status='open')::int AS open_matches,
        (SELECT count(*) FROM claims WHERE status='pending')::int AS pending_claims,
        (SELECT count(*) FROM lost_items)::int  AS lost_total,
        (SELECT count(*) FROM found_items)::int AS found_total,
        (SELECT count(*) FROM lost_items WHERE status='returned')::int AS returned_total,
        (SELECT count(*) FROM users WHERE role='student')::int AS students`);
    return res.json(rows[0]);
  }
  const { rows } = await db.query(`
    SELECT
      (SELECT count(*) FROM lost_items  WHERE user_id=$1)::int AS lost_total,
      (SELECT count(*) FROM found_items WHERE user_id=$1)::int AS found_total,
      (SELECT count(*) FROM lost_items  WHERE user_id=$1 AND status='returned')::int AS returned_total,
      (SELECT count(*) FROM claims WHERE student_user_id=$1 AND status='pending')::int AS pending_claims`,
    [req.user.id]);
  res.json(rows[0]);
}));

// GET /api/users   (admin)
router.get('/users', requireRole('admin'), wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.student_id, u.name, u.email, u.role, u.created_at,
            (SELECT count(*) FROM lost_items  WHERE user_id=u.id)::int AS lost_count,
            (SELECT count(*) FROM found_items WHERE user_id=u.id)::int AS found_count
     FROM users u ORDER BY u.created_at DESC`);
  res.json({ users: rows });
}));

module.exports = router;
