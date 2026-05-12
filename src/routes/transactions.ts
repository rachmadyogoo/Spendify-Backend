import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/authMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { z } from 'zod';
import { parseExcelBuffer } from '../utils/parseExcel';
import { getTransactionsByUser, deleteTransaction, insertBulkTransactions, insertTransaction } from '../db/queries/transactionQueries';
import { analyzeReceipt } from '../ai/aiService';
import { supabase } from '../utils/supabaseClient';

const router = Router();

// Konfigurasi multer menggunakan memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit 5MB
  fileFilter: (req, file, cb) => {
    // Pastikan ekstensi xlsx atau tipe mime sesuai
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.originalname.match(/\.xlsx$/)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file Excel (.xlsx) yang diperbolehkan!'));
    }
  }
});

// GET /api/transactions
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const transactions = await getTransactionsByUser(userId);
    return res.json({ status: 'success', data: { transactions } });
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const transactionId = req.params.id as string;
    const isDeleted = await deleteTransaction(transactionId, userId);
    
    if (!isDeleted) {
      return res.status(404).json({ status: 'error', message: 'Transaksi tidak ditemukan' });
    }
    
    return res.json({ status: 'success', message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
});

const manualTransactionSchema = z.object({
  body: z.object({
    tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    kategori: z.string().min(1, 'Kategori wajib diisi'),
    jumlah: z.number().positive('Jumlah harus lebih dari 0'),
    deskripsi: z.string().min(1, 'Deskripsi wajib diisi'),
  }),
});

// POST /api/transactions
router.post('/', authenticateJWT, validate(manualTransactionSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tanggal, kategori, jumlah, deskripsi } = req.body;
    
    const newTransaction = await insertTransaction(userId, {
      tanggal,
      kategoriNama: kategori,
      jumlah,
      deskripsi
    });

    return res.status(201).json({
      status: 'success',
      message: 'Transaksi berhasil ditambahkan',
      data: {
        transaction: newTransaction
      }
    });
  } catch (error) {
    console.error('Insert manual transaction error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
});

// POST /api/transactions/upload
router.post('/upload', authenticateJWT, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'File tidak ditemukan (Gunakan field "file" pada form-data)' });
    }

    // 1. Upload ke Supabase Bucket
    const bucketName = process.env.SUPABASE_BUCKET || 'ExcleFile';
    const fileName = `${userId}/${Date.now()}-${req.file.originalname}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ status: 'error', message: 'Gagal mengunggah file ke storage: ' + uploadError.message });
    }

    // 2. Parsing Excel dari buffer (tetap pakai buffer karena sudah ada di memory)
    let parsedRows;
    try {
      parsedRows = parseExcelBuffer(req.file.buffer);
    } catch (parseErr: any) {
      return res.status(400).json({ status: 'error', message: parseErr.message || 'Gagal mem-parsing file Excel' });
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'File Excel kosong atau format tidak sesuai' });
    }

    // 3. Insert ke Database
    const insertedCount = await insertBulkTransactions(userId, parsedRows);

    return res.status(201).json({
      status: 'success',
      message: `Berhasil mengunggah file ke storage dan menyimpan ${insertedCount} transaksi.`,
      data: {
        insertedCount,
        filePath: uploadData.path
      }
    });

  } catch (error) {
    console.error('Upload transaction error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat memproses file' });
  }
});

// POST /api/transactions/scan
router.post('/scan', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ status: 'error', message: 'Gambar tidak ditemukan' });
    }

    const data = await analyzeReceipt(image);
    return res.json({ status: 'success', data });
  } catch (error) {
    console.error('Scan receipt error:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses gambar struk' });
  }
});

export default router;
