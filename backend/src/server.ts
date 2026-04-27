import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from './db';
import { User, Client, Debt, Transaction, Settings, CashBalance } from './models';

dotenv.config();

const app = express();

/* =========================
   CORS CONFIG (FIXED)
========================= */

const allowedOrigins = [
  'http://localhost:3000',
  'https://agprogram-e9b7.vercel.app'
];

const corsOptions = {
  origin: function (origin: any, callback: any) {
    // allow Postman / mobile apps
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false); // silently block invalid origins
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* =========================
   BASIC MIDDLEWARE
========================= */

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

/* =========================
   ENV
========================= */

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/* =========================
   DB CONNECTION
========================= */

connectDB();

/* =========================
   TYPES
========================= */

interface AuthRequest extends Request {
  user?: any;
}

/* =========================
   AUTH MIDDLEWARE
========================= */

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

/* =========================
   HEALTH CHECK
========================= */

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Backend running' });
});

app.get('/cors-test', (req, res) => {
  res.json({ message: 'CORS working' });
});

/* =========================
   AUTH ROUTES
========================= */

app.post('/api/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword
    });

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

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   DASHBOARD
========================= */

app.get('/api/dashboard', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await Transaction.find({});
    const debts = await Debt.find({ status: 'unpaid' });

    const cash = await CashBalance.findOne({}) || {
      system_usd: 0,
      system_lbp: 0,
      mobile_usd: 0,
      mobile_lbp: 0,
      physical_usd: 0,
      physical_lbp: 0
    };

    const RATE = 90000;

    const balance =
      (Number(cash.system_usd || 0) + Number(cash.system_lbp || 0) / RATE) +
      (Number(cash.mobile_usd || 0) + Number(cash.mobile_lbp || 0) / RATE) +
      (Number(cash.physical_usd || 0) + Number(cash.physical_lbp || 0) / RATE);

    let totalCommissions = 0;
    transactions.forEach(t => totalCommissions += Number(t.commission || 0));

    let owedToMe = 0;
    let iOwe = 0;

    debts.forEach(d => {
      if (d.type === 'owed_to_me') owedToMe += Number(d.amount);
      else iOwe += Number(d.amount);
    });

    const clientSummaries = await Debt.aggregate([
      { $match: { status: 'unpaid' } },
      {
        $group: {
          _id: '$client_id',
          owed_to_me: { $sum: { $cond: [{ $eq: ['$type', 'owed_to_me'] }, '$amount', 0] } },
          i_owe: { $sum: { $cond: [{ $eq: ['$type', 'i_owe'] }, '$amount', 0] } }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client_info'
        }
      },
      { $unwind: '$client_info' },
      {
        $project: {
          id: '$_id',
          name: '$client_info.name',
          owed_to_me: 1,
          i_owe: 1
        }
      },
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

/* =========================
   TRANSACTIONS (UNCHANGED)
========================= */

app.get('/api/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await Transaction.find()
      .populate('client_id', 'name')
      .sort({ createdAt: -1 });

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

/* =========================
   CLIENTS / DEBTS / CASH / SETTINGS
   (UNCHANGED LOGIC)
========================= */

/* ... keep your other routes exactly as they are ... */

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.url
  });
});

/* =========================
   ERROR HANDLER
========================= */

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});