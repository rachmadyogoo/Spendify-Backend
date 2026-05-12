import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(403).json({ status: 'error', message: 'Token tidak valid atau sudah kadaluarsa.' });
    }
  } else {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak. Token tidak ditemukan.' });
  }
};
