import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String }
}, { timestamps: true });

export const Client = mongoose.model('Client', ClientSchema);

const DebtSchema = new mongoose.Schema({
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['owed_to_me', 'i_owe'], required: true },
  status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' }
}, { timestamps: true });

export const Debt = mongoose.model('Debt', DebtSchema);

const TransactionSchema = new mongoose.Schema({
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  commission: { type: Number, default: 0 },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }
}, { timestamps: true });

export const Transaction = mongoose.model('Transaction', TransactionSchema);

const SettingsSchema = new mongoose.Schema({
  opening_balance: { type: Number, default: 0 }
});

export const Settings = mongoose.model('Settings', SettingsSchema);

const CashBalanceSchema = new mongoose.Schema({
  system_usd: { type: Number, default: 0 },
  system_lbp: { type: Number, default: 0 },
  mobile_usd: { type: Number, default: 0 },
  mobile_lbp: { type: Number, default: 0 },
  physical_usd: { type: Number, default: 0 },
  physical_lbp: { type: Number, default: 0 }
});

export const CashBalance = mongoose.model('CashBalance', CashBalanceSchema);
