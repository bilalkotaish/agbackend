import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Client } from './models';

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://bilalkotaish283_db_user:bilal2000@cluster0.gezxjt9.mongodb.net/";

const addAyoub = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    const existing = await Client.findOne({ name: 'Ayoub' });
    if (existing) {
      console.log('Ayoub already exists in the database.');
    } else {
      const ayoub = new Client({ name: 'Ayoub' });
      await ayoub.save();
      console.log('Ayoub client added successfully.');
    }
  } catch (err: any) {
    console.error('Error adding Ayoub:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

addAyoub();
