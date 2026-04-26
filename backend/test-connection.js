import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const testConnection = async () => {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Attempting to connect...');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    
    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
  } catch (err) {
    console.error('❌ FAILURE: Could not connect to MongoDB Atlas.');
    console.error('Error details:', err.message);
    process.exit(1);
  }
};

testConnection();
