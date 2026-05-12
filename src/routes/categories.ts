import { Router, Request, Response } from 'express';
import { getAllCategories } from '../db/queries/categoryQueries';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// GET /api/categories
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const categories = await getAllCategories();
    return res.json({ status: 'success', data: { categories } });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

export default router;
