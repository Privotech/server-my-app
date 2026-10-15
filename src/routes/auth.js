const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const store = require('../store');
const auth = require('../middleware/auth');
const router = express.Router();
const safeUser = ({ passwordHash, ...user }) => user;

router.post('/register', async (req, res, next) => {
  try {
    const fields = ['email', 'password', 'surName', 'firstName', 'phoneNumber', 'address', 'gender'];
    if (!fields.every((field) => typeof req.body[field] === 'string' && req.body[field].trim())) return res.status(400).json({ message: 'Please provide all required fields' });
    const email = req.body.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (req.body.password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const created = await store.update(async (db) => {
      if (db.users.some((user) => user.email === email)) return null;
      const user = { id: crypto.randomUUID(), email, passwordHash: await bcrypt.hash(req.body.password, 12), surName: req.body.surName.trim(), firstName: req.body.firstName.trim(), phoneNumber: req.body.phoneNumber.trim(), address: req.body.address.trim(), gender: req.body.gender.trim(), createdAt: new Date().toISOString(), settings: { theme: 'light', savingsEnabled: false, facialAuthEnabled: false } };
      const account = { id: crypto.randomUUID(), userId: user.id, number: String(Math.floor(1000000000 + Math.random() * 9000000000)), balanceKobo: 1250000, currency: 'NGN' };
      db.users.push(user); db.accounts.push(account);
      return { user: safeUser(user), account };
    });
    if (!created) return res.status(409).json({ message: 'An account with this email already exists' });
    res.status(201).json({ message: 'Registration successful', ...created });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const db = await store.read();
    const user = db.users.find((item) => item.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
    const token = jwt.sign({}, process.env.JWT_SECRET, { subject: user.id, expiresIn: '2h' });
    res.json({ message: 'Login successful', token, user: safeUser(user) });
  } catch (error) { next(error); }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const db = await store.read();
    const user = db.users.find((item) => item.id === req.userId);
    const account = db.accounts.find((item) => item.userId === req.userId);
    res.json({ user: safeUser(user), account: { ...account, balance: account.balanceKobo / 100 } });
  } catch (error) { next(error); }
});

router.patch('/account', auth, async (req, res, next) => {
  try {
    const allowed = ['surName', 'firstName', 'phoneNumber', 'address', 'gender', 'occupation', 'dob', 'nationality', 'avatar'];
    const user = await store.update((db) => {
      const current = db.users.find((item) => item.id === req.userId);
      for (const key of allowed) if (typeof req.body[key] === 'string') current[key] = req.body[key].trim();
      current.fullName = [current.firstName, current.surName].filter(Boolean).join(' ');
      return safeUser(current);
    });
    res.json({ user });
  } catch (error) { next(error); }
});

router.get('/transactions', auth, async (req, res, next) => {
  try {
    const db = await store.read();
    res.json({ transactions: db.transactions.filter((tx) => tx.userId === req.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } catch (error) { next(error); }
});

router.post('/transfers', auth, async (req, res, next) => {
  try {
    const { toAccount, toBank, amount, description = '' } = req.body;
    const value = Number(amount);
    if (typeof toAccount !== 'string' || !toAccount.trim() || typeof toBank !== 'string' || !toBank.trim() || !Number.isFinite(value) || value <= 0 || value > 10000000) return res.status(400).json({ message: 'Enter valid recipient details and an amount up to ₦10,000,000' });
    const result = await store.update((db) => {
      const account = db.accounts.find((item) => item.userId === req.userId);
      const kobo = Math.round(value * 100);
      if (!account || account.balanceKobo < kobo) return null;
      account.balanceKobo -= kobo;
      const tx = { id: crypto.randomUUID(), userId: req.userId, type: 'transfer', createdAt: new Date().toISOString(), description: description.trim() || `Transfer to ${toAccount.trim()}`, amount: -value, status: 'Completed', recipient: toAccount.trim(), bank: toBank.trim() };
      db.transactions.push(tx);
      return { transaction: tx, balance: account.balanceKobo / 100 };
    });
    if (!result) return res.status(400).json({ message: 'Insufficient balance' });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.post('/deposits', auth, async (req, res, next) => {
  try {
    const { bankName, ownerName, amount } = req.body;
    const value = Number(amount);
    if (typeof bankName !== 'string' || !bankName.trim() || typeof ownerName !== 'string' || !ownerName.trim() || !Number.isFinite(value) || value <= 0 || value > 10000000) return res.status(400).json({ message: 'Enter valid deposit details and an amount up to ₦10,000,000' });
    const result = await store.update((db) => {
      const account = db.accounts.find((item) => item.userId === req.userId);
      const kobo = Math.round(value * 100);
      account.balanceKobo += kobo;
      const tx = { id: crypto.randomUUID(), userId: req.userId, type: 'demo_deposit', createdAt: new Date().toISOString(), description: 'Demo deposit', amount: value, status: 'Demo completed', sender: ownerName.trim(), bank: bankName.trim() };
      db.transactions.push(tx);
      return { transaction: tx, balance: account.balanceKobo / 100 };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.post('/bill-payments', auth, async (req, res, next) => {
  try {
    const { type, provider, recipient, amount, plan = '' } = req.body;
    const supportedTypes = {
      airtime: 'Airtime top-up',
      data: 'Data bundle',
      electricity: 'Electricity bill',
      tv: 'TV subscription'
    };
    const value = Number(amount);
    const cleanProvider = typeof provider === 'string' ? provider.trim() : '';
    const cleanRecipient = typeof recipient === 'string' ? recipient.trim() : '';
    const cleanPlan = typeof plan === 'string' ? plan.trim() : '';

    if (!Object.hasOwn(supportedTypes, type) ||
        !cleanProvider || cleanProvider.length > 80 ||
        !cleanRecipient || cleanRecipient.length > 40 ||
        !Number.isFinite(value) || value <= 0 || value > 10000000 ||
        cleanPlan.length > 100) {
      return res.status(400).json({ message: 'Enter a valid service, provider, recipient, and amount up to ₦10,000,000' });
    }

    if ((type === 'airtime' || type === 'data') && !/^\+?[\d\s()-]{7,24}$/.test(cleanRecipient)) {
      return res.status(400).json({ message: 'Enter a valid phone number' });
    }

    const result = await store.update((db) => {
      const account = db.accounts.find((item) => item.userId === req.userId);
      const kobo = Math.round(value * 100);
      if (!account || account.balanceKobo < kobo) return null;

      account.balanceKobo -= kobo;
      const description = `${supportedTypes[type]} · ${cleanProvider}${cleanPlan ? ` · ${cleanPlan}` : ''}`;
      const transaction = {
        id: crypto.randomUUID(),
        userId: req.userId,
        type,
        createdAt: new Date().toISOString(),
        description,
        amount: -value,
        status: 'Demo completed',
        recipient: cleanRecipient,
        bank: cleanProvider
      };
      db.transactions.push(transaction);
      return { transaction, balance: account.balanceKobo / 100 };
    });

    if (!result) return res.status(400).json({ message: 'Insufficient balance' });
    res.status(201).json({ ...result, message: 'Demo payment recorded. No real payment was made.' });
  } catch (error) { next(error); }
});

router.post('/support', auth, async (req, res, next) => {
  try {
    const { type = 'message', name = '', email = '', message = '' } = req.body;
    if (typeof message !== 'string' || !message.trim() || message.length > 5000) return res.status(400).json({ message: 'Message is required and must be under 5,000 characters' });
    const ticket = await store.update((db) => {
      const item = { id: crypto.randomUUID(), userId: req.userId, type, name, email, message: message.trim(), createdAt: new Date().toISOString(), status: 'Received' };
      db.support.push(item);
      return item;
    });
    res.status(201).json({ message: 'Your message was received', ticket });
  } catch (error) { next(error); }
});

router.get('/cards', auth, async (req, res, next) => {
  try {
    const cards = await store.update((db) => {
      db.cards ||= [];
      let owned = db.cards.filter((card) => card.userId === req.userId);
      if (!owned.length) {
        owned = [
          { id: crypto.randomUUID(), userId: req.userId, type: 'GlobalTrust Visa', name: 'Demo card', last4: '4567', expires: '08/28', status: 'Active', limit: 1000000, balance: 0 },
          { id: crypto.randomUUID(), userId: req.userId, type: 'GlobalTrust Mastercard', name: 'Demo card', last4: '8910', expires: '03/29', status: 'Active', limit: 800000, balance: 0 }
        ];
        db.cards.push(...owned);
      }
      return owned;
    });
    res.json({ cards });
  } catch (error) { next(error); }
});
router.post('/cards', auth, async (req, res, next) => {
  try {
    const card = await store.update((db) => {
      db.cards ||= [];
      const item = { id: crypto.randomUUID(), userId: req.userId, type: 'PrivoBank Visa', name: String(req.body.name || 'Demo cardholder').slice(0, 80), last4: String(1000 + Math.floor(Math.random() * 9000)), expires: '12/29', status: 'Active', limit: 500000, balance: 0 };
      db.cards.push(item);
      return item;
    });
    res.status(201).json({ card });
  } catch (error) { next(error); }
});
router.patch('/cards/:id', auth, async (req, res, next) => {
  try {
    const card = await store.update((db) => {
      const item = (db.cards || []).find((entry) => entry.id === req.params.id && entry.userId === req.userId);
      if (!item) return null;
      item.status = item.status === 'Active' ? 'Locked' : 'Active';
      return item;
    });
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json({ card });
  } catch (error) { next(error); }
});
router.get('/settings', auth, async (req, res, next) => {
  try {
    const db = await store.read();
    const user = db.users.find((item) => item.id === req.userId);
    res.json({ settings: user.settings || { theme: 'light', savingsEnabled: false, facialAuthEnabled: false } });
  } catch (error) { next(error); }
});
router.patch('/settings', auth, async (req, res, next) => {
  try {
    const settings = await store.update((db) => {
      const user = db.users.find((item) => item.id === req.userId);
      user.settings ||= { theme: 'light', savingsEnabled: false, facialAuthEnabled: false };
      if (['light', 'dark'].includes(req.body.theme)) user.settings.theme = req.body.theme;
      for (const key of ['savingsEnabled', 'facialAuthEnabled']) if (typeof req.body[key] === 'boolean') user.settings[key] = req.body[key];
      return user.settings;
    });
    res.json({ settings });
  } catch (error) { next(error); }
});
module.exports = router;