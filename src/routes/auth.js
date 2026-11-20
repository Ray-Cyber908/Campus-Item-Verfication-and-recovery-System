const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { wrap, missing, clean } = require('../utils/helpers');

const router = express.Router();

const publicUser = (u) => ({
  id: u.id, student_id: u.student_id, name: u.name, email: u.email, role: u.role, created_at: u.created_at,
});

// POST /api/auth/register
router.post('/register', wrap(async (req, res) => {
  const miss = missing(req.body, ['student_id', 'name', 'email', 'password']);
  if (miss.length) return res.status(400).json({ error: `Please fill in: ${miss.join(', ')}.` });
  if (String(req.body.password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(req.body.email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (student_id, name, email, password_hash)
       VALUES ($1, $2, lower($3), $4) RETURNING *`,
      [clean(req.body.student_id), clean(req.body.name), clean(req.body.email), hash]
    );
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this Student ID or email already exists.' });
    }
    throw err;
  }
}));

// POST /api/auth/login   { identifier: "student id or email", password }
router.post('/login', wrap(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your Student ID / email and password.' });
  }
  const { rows } = await db.query(
    'SELECT * FROM users WHERE lower(email) = lower($1) OR lower(student_id) = lower($1)',
    [String(identifier).trim()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect Student ID / email or password.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// GET /api/auth/me
router.get('/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: publicUser(rows[0]) });
}));

module.exports = router;
