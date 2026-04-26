import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Client, Debt, Transaction, Settings, CashBalance } from './models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance';

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Client.deleteMany({});
    await Debt.deleteMany({});
    await Transaction.deleteMany({});
    await Settings.deleteMany({});
    await CashBalance.deleteMany({});

    // Seed User
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({ username: 'admin', password: hashedPassword });
    await admin.save();
    console.log('Admin user seeded');

    // Seed Clients
    const client1 = new Client({ name: 'John Doe', phone: '123456789' });
    const client2 = new Client({ name: 'Jane Smith', phone: '987654321' });
    await client1.save();
    await client2.save();
    console.log('Clients seeded');

    // Seed Debts
    const debt1 = new Debt({ client_id: client1._id, amount: 500, type: 'owed_to_me', status: 'unpaid' });
    const debt2 = new Debt({ client_id: client2._id, amount: 200, type: 'i_owe', status: 'unpaid' });
    await debt1.save();
    await debt2.save();
    console.log('Debts seeded');

    // Seed Settings & Cash
    await new Settings({ opening_balance: 1000 }).save();
    await new CashBalance({ system_usd: 500, system_lbp: 45000000 }).save();
    console.log('Settings and Cash balance seeded');

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seed();
