const jwt = require('jsonwebtoken');
const store = require('../store');

module.exports = async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ message: 'Sign in to continue' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const db = await store.read();
    if (!db.users.some((user) => user.id === payload.sub)) return res.status(401).json({ message: 'Account not found' });
    req.userId = payload.sub;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    return next(error);
  }
};