/**
 * Smart matching algorithm
 * ------------------------
 * Compares a lost report with a found report and returns a score from 0 to 100.
 * Items of different categories never match (score 0).
 *
 *   Category match ........ 30   (required)
 *   Brand ................. 15   (equal = 15, one side blank = 5)
 *   Colour ................ 15   (equal = 15, one side blank = 5)
 *   Location .............. 10   (word overlap between the two places)
 *   Date .................. 10   (found on/after lost date, closer = better)
 *   Description ........... 10   (word overlap)
 *   Identification ........ 10   (secret details vs found description + hidden notes)
 */

const MIN_SCORE = 50; // matches below this are not shown to admins

const STOP = new Set([
  'the', 'and', 'with', 'for', 'was', 'has', 'have', 'this', 'that', 'from', 'are', 'its',
  'inside', 'near', 'slightly', 'very', 'item', 'side', 'there', 'their', 'one', 'not',
]);

const norm = (s) => String(s || '').toLowerCase().trim();

function tokens(s) {
  return new Set(
    norm(s)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  a.forEach((w) => b.has(w) && common++);
  return common / Math.min(a.size, b.size); // 0..1
}

function daysBetween(d1, d2) {
  return (new Date(d2) - new Date(d1)) / 86400000;
}

function computeScore(lost, found) {
  if (norm(lost.category) !== norm(found.category)) return 0;
  let score = 30;

  // Brand
  if (norm(lost.brand) && norm(found.brand)) score += norm(lost.brand) === norm(found.brand) ? 15 : 0;
  else score += 5;

  // Colour
  if (norm(lost.color) && norm(found.color)) score += norm(lost.color) === norm(found.color) ? 15 : 0;
  else score += 5;

  // Location
  const la = norm(lost.last_seen_location), lb = norm(found.found_location);
  score += la === lb ? 10 : Math.round(overlap(tokens(la), tokens(lb)) * 10);

  // Date (item should be found on/after it was lost; allow 2 days tolerance)
  const diff = daysBetween(lost.date_lost, found.date_found);
  if (diff >= -2) {
    if (diff <= 3) score += 10;
    else if (diff <= 7) score += 6;
    else if (diff <= 30) score += 3;
  }

  // Description words
  score += Math.round(overlap(tokens(lost.description), tokens(found.description)) * 10);

  // Identification details (lost owner's secret info vs found item's text)
  const lostSecret = tokens([lost.identification_details, ...(lost.identifiers || [])].join(' '));
  const foundText = tokens([found.description, found.hidden_details, found.condition].join(' '));
  score += Math.round(overlap(lostSecret, foundText) * 10);

  return Math.max(0, Math.min(100, score));
}

async function saveMatch(client, lostId, foundId, score) {
  if (score < MIN_SCORE) return;
  const existing = await client.query(
    'SELECT id, status FROM matches WHERE lost_item_id = $1 AND found_item_id = $2',
    [lostId, foundId]
  );
  if (existing.rows.length) {
    if (existing.rows[0].status === 'open') {
      await client.query('UPDATE matches SET score = $1 WHERE id = $2', [score, existing.rows[0].id]);
    }
    return;
  }
  await client.query(
    'INSERT INTO matches (lost_item_id, found_item_id, score) VALUES ($1, $2, $3)',
    [lostId, foundId, score]
  );
}

// Run after a NEW lost report: compare against all open found reports
async function runMatchingForLost(client, lost) {
  const { rows } = await client.query(
    "SELECT * FROM found_items WHERE status = 'open' AND lower(category) = lower($1)",
    [lost.category]
  );
  for (const found of rows) await saveMatch(client, lost.id, found.id, computeScore(lost, found));
}

// Run after a NEW found report: compare against all open lost reports
async function runMatchingForFound(client, found) {
  const { rows } = await client.query(
    "SELECT * FROM lost_items WHERE status = 'open' AND lower(category) = lower($1)",
    [found.category]
  );
  for (const lost of rows) await saveMatch(client, lost.id, found.id, computeScore(lost, found));
}

module.exports = { computeScore, runMatchingForLost, runMatchingForFound, MIN_SCORE };
