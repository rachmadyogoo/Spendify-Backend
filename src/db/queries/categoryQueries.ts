import { pool } from '../pool';

export async function getAllCategories() {
  const result = await pool.query(
    `SELECT * FROM kategori ORDER BY nama ASC`
  );
  return result.rows;
}