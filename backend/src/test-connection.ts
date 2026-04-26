import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const testConnection = async () => {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Attempting to connect to:', MONGODB_URI.split('@')[1]); // Log host only for security

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    
    // Check if we can perform a simple operation
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Collections in database:', collections.map(c => c.name));
    } else {
      console.log('Connected, but database object is undefined.');
    }
    
    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ FAILURE: Could not connect to MongoDB Atlas.');
    console.error('Error details:', err.message);
    process.exit(1);
  }
};

testConnection();
