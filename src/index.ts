import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import transactionRoutes from './routes/transactions';
import aiRoutes from './routes/ai';
import challengeRoutes from './routes/challenges';

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/challenges', challengeRoutes);

const server = app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`🔗 API Base URL: http://localhost:${port}/api`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} sudah digunakan oleh proses lain.`);
  } else {
    console.error('❌ Gagal menjalankan server:', err);
  }
});
