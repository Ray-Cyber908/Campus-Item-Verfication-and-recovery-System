require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { UPLOAD_DIR } = require('./middleware/upload');
const { pool, mode } = require('./db');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lost', require('./routes/lost'));
app.use('/api/found', require('./routes/found'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api', require('./routes/misc'));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// ---------- Uploaded photos (random, unguessable file names) ----------
app.use('/uploads', express.static(UPLOAD_DIR, { index: false }));

// ---------- Frontend (static files) ----------
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be smaller than 5 MB.' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err.message && err.message.startsWith('Only JPG')) return res.status(400).json({ error: err.message });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Campus Lost & Found running at http://localhost:${PORT}  (database: ${mode})`));

// Close the database cleanly on Ctrl+C
['SIGINT', 'SIGTERM'].forEach((sig) =>
  process.on(sig, async () => { try { await pool.end(); } catch (e) { /* ignore */ } process.exit(0); }));
