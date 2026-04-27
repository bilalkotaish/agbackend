import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from './db';
import { User, Client, Debt, Transaction, Settings, CashBalance } from './models';

dotenv.config();

const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});
app.use(express.json());


const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Connect to Database
connectDB();

// Trust proxy for cloud deployments
app.set('trust proxy', 1);

// Types
interface AuthRequest extends Request {
  user?: any;
}

// Middleware for Auth
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TypeScript Backend is running' });
});

// AUTH
app.post('/api/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DASHBOARD
app.get('/api/dashboard', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await Transaction.find({});
    const debts = await Debt.find({ status: 'unpaid' });
    const settings = await Settings.findOne({});
    const cash = await CashBalance.findOne({}) || { system_usd: 0, system_lbp: 0, mobile_usd: 0, mobile_lbp: 0, physical_usd: 0, physical_lbp: 0 };
    
    const RATE = 90000;

    const balance = 
      (Number(cash.system_usd || 0) + Number(cash.system_lbp || 0) / RATE) +
      (Number(cash.mobile_usd || 0) + Number(cash.mobile_lbp || 0) / RATE) +
      (Number(cash.physical_usd || 0) + Number(cash.physical_lbp || 0) / RATE);

    let totalCommissions = 0;
    transactions.forEach(t => {
      totalCommissions += Number(t.commission || 0);
    });

    let owedToMe = 0;
    let iOwe = 0;
    debts.forEach(d => {
      if (d.type === 'owed_to_me') owedToMe += Number(d.amount);
      else iOwe += Number(d.amount);
    });

    // Aggregation for client summaries
    const clientSummaries = await Debt.aggregate([
      { $match: { status: 'unpaid' } },
      { $group: {
        _id: '$client_id',
        owed_to_me: { $sum: { $cond: [{ $eq: ['$type', 'owed_to_me'] }, '$amount', 0] } },
        i_owe: { $sum: { $cond: [{ $eq: ['$type', 'i_owe'] }, '$amount', 0] } }
      }},
      { $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'client_info'
      }},
      { $unwind: '$client_info' },
      { $project: {
        id: '$_id',
        name: '$client_info.name',
        owed_to_me: 1,
        i_owe: 1
      }},
      { $limit: 5 }
    ]);

    res.json({
      balance,
      totalCommissions,
      owedToMe,
      iOwe,
      clientSummaries
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// TRANSACTIONS
app.get('/api/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await Transaction.find().populate('client_id', 'name').sort({ createdAt: -1 });
    const formatted = transactions.map(t => ({
      ...t.toObject(),
      id: t._id,
      client_name: (t.client_id as any)?.name || null
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { type, amount, commission, client_id } = req.body;
  if (!type || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount or type' });
  }
  try {
    const trans = new Transaction({ type, amount, commission, client_id: client_id || null });
    await trans.save();
    res.status(201).json({ message: 'Transaction recorded' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// CLIENTS
app.get('/api/clients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    const formatted = clients.map(c => ({ ...c.toObject(), id: c._id }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/clients', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { name, phone } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  try {
    const client = new Client({ name, phone });
    await client.save();
    res.status(201).json({ message: 'Client added' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Client.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: 'Client updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/clients/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DEBTS
app.get('/api/debts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const debts = await Debt.find().populate('client_id', 'name').sort({ createdAt: -1 });
    const formatted = debts.map(d => ({
      ...d.toObject(),
      id: d._id,
      client_name: (d.client_id as any)?.name || 'Unknown'
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/debts', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { client_id, amount, type } = req.body;
  if (!client_id || !amount || amount <= 0 || !type) {
    return res.status(400).json({ message: 'Invalid debt data' });
  }
  try {
    const debt = new Debt({ client_id, amount, type, status: 'unpaid' });
    await debt.save();
    res.status(201).json({ message: 'Debt recorded' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/debts/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Debt.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: 'Debt updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/debts/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Debt.findByIdAndDelete(req.params.id);
    res.json({ message: 'Debt deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/debts/:id/pay', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Debt.findByIdAndUpdate(req.params.id, { status: 'paid' });
    res.json({ message: 'Debt marked as paid' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// CASH BALANCE
app.get('/api/cash-balance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let cash = await CashBalance.findOne({});
    if (!cash) {
      cash = new CashBalance({});
      await cash.save();
    }
    res.json(cash);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/cash-balance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await CashBalance.findOneAndUpdate({}, req.body, { upsert: true });
    res.json({ message: 'Cash balance updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// SETTINGS
app.post('/api/settings/balance', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { amount } = req.body;
  try {
    await Settings.findOneAndUpdate({}, { opening_balance: amount }, { upsert: true });
    res.json({ message: 'Opening balance updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Catch-all for 404s
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: 'Route not found on backend', 
    path: req.url,
    method: req.method 
  });
});

// Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
