import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
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

// Test Route
app.get('/', (req, res) => {
  res.send('Backend jalan');
});

// Listen Server
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
