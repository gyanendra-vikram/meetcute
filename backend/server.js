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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.use('/dating', datingRoutes);
app.use('/admin/memes', memeAdminRoutes);

startRedditMemeIngestion();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
