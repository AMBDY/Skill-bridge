const jwt = require('jsonwebtoken');
const { supabase } = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'skillbridge-dev-secret';

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const userId = decoded.sub || decoded.id;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    // Look up the user's role from profiles table
    const { data: profile } = await supabase.from('profiles').select('role, email, display_name').eq('user_id', userId).maybeSingle();
    req.user = {
      id: userId,
      email: profile?.email || decoded.email || '',
      role: profile?.role || '',
      display_name: profile?.display_name || ''
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET };
