import { pool } from '../pool';
import { ParsedTransactionRow } from '../../utils/parseExcel';

export async function getTransactionsByUser(userId: string) {
  const result = await pool.query(
    `SELECT p.*, k.nama AS kategori_nama, k.icon AS kategori_icon
     FROM pengeluaran p
     JOIN kategori k ON p.kategori_id = k.id
     WHERE p.user_id = $1
     ORDER BY p.tanggal DESC, p.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function deleteTransaction(transactionId: string, userId: string) {
  const result = await pool.query(
    `DELETE FROM pengeluaran WHERE id = $1 AND user_id = $2 RETURNING id`,
    [transactionId, userId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

export async function insertBulkTransactions(userId: string, rows: ParsedTransactionRow[]) {
  // Ambil semua kategori untuk mapping string kategori_nama ke kategori_id
  const catResult = await pool.query(`SELECT id, nama FROM kategori`);
  const categories = catResult.rows;

  // Dictionary untuk pencarian cepat, case-insensitive
  const catMap: Record<string, string> = {};
  categories.forEach(c => {
    catMap[c.nama.toLowerCase()] = c.id;
  });

  // Cari ID kategori fallback (misalnya "Lainnya")
  const defaultCategory = categories.find(c => c.nama.toLowerCase() === 'lainnya');
  const defaultCategoryId = defaultCategory ? defaultCategory.id : categories[0].id; // fallback ke yg pertama jika gak ada "lainnya"

  const client = await pool.connect();
  let insertedCount = 0;

  try {
    await client.query('BEGIN');
    
    for (const row of rows) {
      // Cari Kategori ID
      const catNameLower = row.kategoriNama.toLowerCase();
      let kategoriId = catMap[catNameLower];

      // Jika kategori dari Excel tidak ada di database kita, jadikan "Lainnya"
      if (!kategoriId) {
        kategoriId = defaultCategoryId;
      }

      await client.query(
        `INSERT INTO pengeluaran (user_id, kategori_id, jumlah, deskripsi, tanggal)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, kategoriId, row.jumlah, row.deskripsi, row.tanggal]
      );
      insertedCount++;
    }

    await client.query('COMMIT');
    return insertedCount;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function insertTransaction(userId: string, data: { tanggal: string, kategoriNama: string, jumlah: number, deskripsi: string }) {
  // Cari kategori ID berdasarkan nama
  const catResult = await pool.query(`SELECT id FROM kategori WHERE LOWER(nama) = $1`, [data.kategoriNama.toLowerCase()]);
  let kategoriId;

  if (catResult.rows.length > 0) {
    kategoriId = catResult.rows[0].id;
  } else {
    // Fallback ke Lainnya
    const defaultCat = await pool.query(`SELECT id FROM kategori WHERE LOWER(nama) = 'lainnya'`);
    if (defaultCat.rows.length > 0) {
      kategoriId = defaultCat.rows[0].id;
    } else {
      const firstCat = await pool.query(`SELECT id FROM kategori LIMIT 1`);
      kategoriId = firstCat.rows[0].id;
    }
  }

  const result = await pool.query(
    `INSERT INTO pengeluaran (user_id, kategori_id, jumlah, deskripsi, tanggal)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, kategoriId, data.jumlah, data.deskripsi, data.tanggal]
  );
  
  return result.rows[0];
}
