// Wrap async route handlers so errors reach the Express error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Return the list of missing required fields
function missing(body, fields) {
  return fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
}

const clean = (v) => (v === undefined || v === null ? null : String(v).trim() || null);

const toArray = (v) => (v === undefined || v === null ? [] : [].concat(v)).map(String).filter(Boolean);

const photoUrl = (file) => (file ? `/uploads/${file.filename}` : null);

module.exports = { wrap, missing, clean, toArray, photoUrl };
