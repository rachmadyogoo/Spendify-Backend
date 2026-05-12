import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,            
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Tingkatkan timeout ke 10 detik
  ssl: {
    rejectUnauthorized: false
  }
});
