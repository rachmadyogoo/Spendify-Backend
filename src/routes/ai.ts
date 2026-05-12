import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
import { generateMonthlyWrapped } from '../ai/aiService';
import { pool } from '../db/pool';

const router = Router();

// GET /api/ai/wrapped/:year/:month
router.get('/wrapped/:year/:month', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { year, month } = req.params;

    // 1. Check if wrapped data already exists in DB
    const existingWrapped = await pool.query(
      `SELECT * FROM user_monthly_wrapped WHERE user_id = $1 AND tahun = $2 AND bulan = $3`,
      [userId, year, month]
    );

    if (existingWrapped.rows.length > 0) {
      return res.json({ status: 'success', data: existingWrapped.rows[0].data });
    }

    // 2. If not, generate new wrapped data
    const wrappedData = await generateMonthlyWrapped(userId, month as string, year as string);
    
    if (!wrappedData) {
      return res.status(400).json({ status: 'error', message: 'Belum ada data transaksi yang cukup untuk bulan ini.' });
    }

    return res.status(201).json({ status: 'success', message: 'Wrapped berhasil dibuat', data: wrappedData });
  } catch (error: any) {
    console.error('Generate wrapped error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memanggil AI' });
  }
});

export default router;
