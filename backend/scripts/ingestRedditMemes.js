import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { runRedditMemeIngestion } from '../services/redditMemeIngestion.js';

dotenv.config();
await connectDB();

try {
  const result = await runRedditMemeIngestion();
  console.info('Reddit meme queue refreshed:', result);
} catch (error) {
  console.error('Reddit meme ingestion failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
