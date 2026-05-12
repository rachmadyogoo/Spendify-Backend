import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
import { getOrGenerateChallenges } from '../ai/aiService';
import * as challengeQueries from '../db/queries/challengeQueries';

const router = Router();

// GET /api/challenges
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    const challenges = await getOrGenerateChallenges(userId, month, year);
    return res.json({ status: 'success', data: { challenges } });
  } catch (error) {
    console.error('Get challenges error:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mendapatkan tantangan' });
  }
});

// POST /api/challenges/generate
router.post('/generate', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year } = req.body;
    
    if (!month || !year) {
      return res.status(400).json({ status: 'error', message: 'Bulan dan tahun wajib diisi' });
    }

    // Force generate: bypass the isCurrentMonth check in aiService if needed
    // or we can just update aiService to always generate if it's missing and we call this
    const challenges = await getOrGenerateChallenges(userId, parseInt(month), parseInt(year), true);
    
    return res.json({ status: 'success', data: { challenges } });
  } catch (error) {
    console.error('Generate challenges error:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal men-generate tantangan' });
  }
});

// PATCH /api/challenges/:id
router.patch('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = parseInt(req.params.id as string);
    const updated = await challengeQueries.toggleChallenge(challengeId, userId);
    
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Tantangan tidak ditemukan' });
    }
    
    return res.json({ status: 'success', data: { challenge: updated } });
  } catch (error) {
    console.error('Toggle challenge error:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui tantangan' });
  }
});

export default router;
