import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import datingRoutes from './routes/datingRoutes.js';
import memeAdminRoutes from './routes/memeAdminRoutes.js';
import { startRedditMemeIngestion } from './services/redditMemeIngestion.js';


connectDB();

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0
    ? (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin))
    : true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.use('/dating', datingRoutes);
app.use('/admin/memes', memeAdminRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

startRedditMemeIngestion();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
