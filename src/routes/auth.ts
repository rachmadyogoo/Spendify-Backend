import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { validate } from '../middleware/validateMiddleware';
import { createUser, getUserByEmail, getUserById, updateUangBulanan } from '../db/queries/userQueries';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Zod Schemas
const registerSchema = z.object({
  body: z.object({
    nama: z.string().min(2, 'Nama minimal 2 karakter'),
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(1, 'Password wajib diisi'),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    uangBulanan: z.number().positive('Uang bulanan harus lebih dari 0'),
  }),
});


// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { nama, email, password } = req.body;

    // Cek apakah email sudah terdaftar
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await createUser({
      nama,
      email,
      passwordHash,
    });

    return res.status(201).json({
      status: 'success',
      message: 'Registrasi berhasil',
      data: {
        user: newUser
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Cek user berdasarkan email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Email atau password salah' });
    }

    // Verifikasi password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Email atau password salah' });
    }

    // Generate JWT
    const payload = { id: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '7d' });

    // Hapus password_hash dari response
    const { password_hash, ...userWithoutPassword } = user;

    return res.json({
      status: 'success',
      message: 'Login berhasil',
      data: {
        token,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Karena kita menggunakan JWT di sisi klien, logout cukup memberikan response sukses
  // Klien harus menghapus token dari localStorage/cookies
  return res.json({ status: 'success', message: 'Logout berhasil' });
});

// GET /api/auth/me (Endpoint tambahan untuk ambil data user saat ini)
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });

    return res.json({ status: 'success', data: { user } });
  } catch (error) {
    console.error('Get Me error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// PUT /api/auth/profile (Update uang bulanan)
router.put('/profile', authenticateJWT, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { uangBulanan } = req.body;
    const updatedUser = await updateUangBulanan(userId, uangBulanan);

    return res.json({
      status: 'success',
      message: 'Uang bulanan berhasil diperbarui',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update Profile error:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});


export default router;
