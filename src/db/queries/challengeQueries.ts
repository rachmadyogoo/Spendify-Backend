import { pool } from '../pool';

export async function ensureChallengesTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS user_challenges (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      savings_pct INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await pool.query(query);
}

export async function getChallenges(userId: string, month: number, year: number) {
  await ensureChallengesTable();
  const result = await pool.query(
    `SELECT * FROM user_challenges WHERE user_id = $1 AND month = $2 AND year = $3 ORDER BY id ASC`,
    [userId, month, year]
  );
  return result.rows;
}

export async function insertChallenge(userId: string, month: number, year: number, data: { title: string, savings_pct: number, difficulty: string }) {
  await ensureChallengesTable();
  const result = await pool.query(
    `INSERT INTO user_challenges (user_id, month, year, title, savings_pct, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, month, year, data.title, data.savings_pct, data.difficulty]
  );
  return result.rows[0];
}

export async function toggleChallenge(challengeId: number, userId: string) {
  const result = await pool.query(
    `UPDATE user_challenges SET is_completed = NOT is_completed 
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [challengeId, userId]
  );
  return result.rows[0];
}
