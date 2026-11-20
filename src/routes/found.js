const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { wrap, missing, clean, photoUrl } = require('../utils/helpers');
const { createFoundItem, CATEGORIES } = require('../services/items');

const router = express.Router();
router.use(requireAuth);

// POST /api/found  (multipart/form-data, optional "photo")
router.post('/', upload.single('photo'), wrap(async (req, res) => {
  const b = req.body;
  const miss = missing(b, ['category', 'found_location', 'date_found', 'description']);
  if (miss.length) return res.status(400).json({ error: `Please fill in: ${miss.join(', ').replace(/_/g, ' ')}.` });
  if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'Choose a valid category.' });

  const item = await createFoundItem(req.user.id, {
    category: b.category,
    brand: clean(b.brand),
    color: clean(b.color),
    found_location: clean(b.found_location),
    date_found: b.date_found,
    condition: clean(b.condition),
    description: clean(b.description),
    hidden_details: clean(b.hidden_details), // secret: never exposed to students
  }, photoUrl(req.file));

  res.status(201).json({ id: item.id, report_code: item.report_code });
}));

// GET /api/found/mine
router.get('/mine', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM found_items WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
  );
  res.json({ items: rows });
}));

// GET /api/found  (admin)
router.get('/', requireRole('admin'), wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT f.*, u.name AS reporter_name, u.student_id AS reporter_student_id
     FROM found_items f JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC`
  );
  res.json({ items: rows });
}));

module.exports = router;
