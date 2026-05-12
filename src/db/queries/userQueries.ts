import { pool } from '../pool';

export interface CreateUserParams {
  nama: string;
  email: string;
  passwordHash: string;
}

export async function createUser(params: CreateUserParams) {
  const result = await pool.query(
    `INSERT INTO users (nama, email, password_hash, uang_bulanan)
     VALUES ($1, $2, $3, 0)
     RETURNING id, nama, email, uang_bulanan, created_at`,
    [
      params.nama,
      params.email,
      params.passwordHash,
    ]
  );
  return result.rows[0];
}

export async function getUserByEmail(email: string) {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0];
}

export async function getUserById(id: string) {
  const result = await pool.query(
    `SELECT id, nama, email, uang_bulanan, created_at, updated_at 
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function updateUangBulanan(id: string, tambahUang: number) {
  const result = await pool.query(
    `UPDATE users SET uang_bulanan = uang_bulanan + $1, updated_at = NOW() WHERE id = $2 RETURNING id, uang_bulanan, updated_at`,
    [tambahUang, id]
  );
  return result.rows[0];
}
