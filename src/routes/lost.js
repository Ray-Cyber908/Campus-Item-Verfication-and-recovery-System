const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { wrap, missing, clean, toArray, photoUrl } = require('../utils/helpers');
const { createLostItem, CATEGORIES } = require('../services/items');

const router = express.Router();
router.use(requireAuth);

router.get('/categories', (req, res) => res.json({ categories: CATEGORIES }));

// POST /api/lost  (multipart/form-data, optional "photo")
router.post('/', upload.single('photo'), wrap(async (req, res) => {
  const b = req.body;
  const miss = missing(b, ['category', 'last_seen_location', 'date_lost', 'description']);
  if (miss.length) return res.status(400).json({ error: `Please fill in: ${miss.join(', ').replace(/_/g, ' ')}.` });
  if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'Choose a valid category.' });

  const item = await createLostItem(req.user.id, {
    category: b.category,
    brand: clean(b.brand),
    color: clean(b.color),
    last_seen_location: clean(b.last_seen_location),
    date_lost: b.date_lost,
    description: clean(b.description),
    identifiers: toArray(b.identifiers),
    identification_details: clean(b.identification_details),
  }, photoUrl(req.file));

  res.status(201).json({ id: item.id, report_code: item.report_code });
}));

// GET /api/lost/mine
router.get('/mine', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
  );
  res.json({ items: rows });
}));

// GET /api/lost  (admin) all lost reports
router.get('/', requireRole('admin'), wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT l.*, u.name AS reporter_name, u.student_id AS reporter_student_id
     FROM lost_items l JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC`
  );
  res.json({ items: rows });
}));

module.exports = router;
